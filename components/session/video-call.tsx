"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Daily, {
  type DailyCall,
  type DailyEventObjectParticipant,
  type DailyEventObjectTrack,
} from "@daily-co/daily-js";
import { Camera, CameraOff, Mic, MicOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The video call, in Daily's call-object mode.
 *
 * This is deliberately not Daily's prebuilt iframe. Prebuilt renders a complete
 * call UI for free, but it does not hand you participant media tracks — and
 * without the patient's audio track there is no way to transcribe the patient.
 * The first version of this product used prebuilt, captured `getUserMedia`
 * alone, and therefore recorded exactly half of every remote session while
 * looking like it worked.
 *
 * Owning the call object costs us this UI. It buys two things that matter more:
 * the patient is actually in the clinical record, and every transcript segment
 * is attributed to a speaker with certainty rather than guessed at, because each
 * participant arrives on a separate track.
 */
export function VideoCall({
  roomUrl,
  token,
  userName,
  micMuted,
  onRemoteAudioTrack,
  onPatientPresence,
  onError,
}: {
  roomUrl: string;
  /** Per-participant meeting token. A private room cannot be joined without it. */
  token: string | null;
  userName: string;
  /** Driven by the room's Off record control — mutes capture *and* the call. */
  micMuted: boolean;
  onRemoteAudioTrack: (track: MediaStreamTrack | null) => void;
  onPatientPresence: (present: boolean) => void;
  onError?: (message: string) => void;
}) {
  const callRef = useRef<DailyCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const [cameraOff, setCameraOff] = useState(false);
  const [remotePresent, setRemotePresent] = useState(false);
  const [joined, setJoined] = useState(false);

  const attachRemote = useCallback(
    (call: DailyCall) => {
      const participants = call.participants();
      const remote = Object.values(participants).find((p) => !p.local);

      if (!remote) {
        setRemotePresent(false);
        onPatientPresence(false);
        onRemoteAudioTrack(null);
        return;
      }

      setRemotePresent(true);
      onPatientPresence(true);

      // `persistentTrack` rather than `track`: it holds a reference regardless
      // of playability, which avoids the black-frame and audio-interruption
      // problems that come from swapping tracks on a media element.
      const audio = remote.tracks.audio?.persistentTrack ?? null;
      const video = remote.tracks.video?.persistentTrack ?? null;

      if (remoteVideoRef.current && video) {
        remoteVideoRef.current.srcObject = new MediaStream([video]);
      }
      if (remoteAudioRef.current && audio) {
        remoteAudioRef.current.srcObject = new MediaStream([audio]);
      }

      onRemoteAudioTrack(audio);
    },
    [onRemoteAudioTrack, onPatientPresence],
  );

  useEffect(() => {
    let cancelled = false;

    // daily-js permits one call object at a time; a stale instance from a fast
    // remount will refuse to join.
    const existing = Daily.getCallInstance();
    const call = existing ?? Daily.createCallObject({ subscribeToTracksAutomatically: true });
    callRef.current = call;

    const onParticipant = (event?: DailyEventObjectParticipant) => {
      if (event?.participant.local) {
        const video = event.participant.tracks.video?.persistentTrack ?? null;
        if (localVideoRef.current && video) {
          localVideoRef.current.srcObject = new MediaStream([video]);
        }
        return;
      }
      attachRemote(call);
    };

    const onTrack = (event?: DailyEventObjectTrack) => {
      if (event?.participant?.local) return;
      attachRemote(call);
    };

    call.on("joined-meeting", () => {
      if (cancelled) return;
      setJoined(true);
      onParticipant();
      attachRemote(call);
    });
    call.on("participant-joined", onParticipant);
    call.on("participant-updated", onParticipant);
    call.on("participant-left", () => attachRemote(call));
    call.on("track-started", onTrack);
    call.on("track-stopped", onTrack);
    call.on("error", (event) => {
      onError?.(event?.errorMsg ?? "The video call hit a problem.");
    });

    void call
      .join({ url: roomUrl, ...(token ? { token } : {}), userName })
      .catch(() => onError?.("Could not connect to the video room."));

    return () => {
      cancelled = true;
      onRemoteAudioTrack(null);
      void call.leave().catch(() => {});
      void call.destroy().catch(() => {});
      callRef.current = null;
    };
    // Intentionally joins once: roomUrl carries a meeting token and does not
    // change for the life of the room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token]);

  // Off record must mute the outgoing call too, not just our capture. A patient
  // should be able to see that the therapist has gone off record.
  useEffect(() => {
    callRef.current?.setLocalAudio(!micMuted);
  }, [micMuted]);

  const toggleCamera = () => {
    const next = !cameraOff;
    setCameraOff(next);
    callRef.current?.setLocalVideo(!next);
  };

  return (
    <div className="relative aspect-[3/4] w-full bg-black sm:aspect-video">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={cn("h-full w-full object-cover", !remotePresent && "opacity-0")}
      />
      {/* Remote audio is played by its own element; the recorder taps the track
          separately so playback and capture never fight over it. */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {!remotePresent ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-6 text-center">
          <p className="text-sm font-medium text-slate-300">
            {joined ? "Waiting for your patient to join" : "Connecting…"}
          </p>
          <p className="max-w-xs text-xs text-slate-500">
            Share the join link below. They need no account.
          </p>
        </div>
      ) : null}

      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "absolute end-3 bottom-3 h-28 w-20 rounded-xl border border-white/20 object-cover shadow-lg sm:h-32 sm:w-24",
          cameraOff && "hidden",
        )}
      />

      <div className="absolute bottom-3 start-3 flex gap-2">
        <button
          type="button"
          onClick={toggleCamera}
          aria-pressed={cameraOff}
          aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
          className="tap-target flex items-center justify-center rounded-xl bg-black/50 px-3 text-white backdrop-blur active:bg-black/70"
        >
          {cameraOff ? (
            <CameraOff className="h-4 w-4" aria-hidden />
          ) : (
            <Camera className="h-4 w-4" aria-hidden />
          )}
        </button>
        <span
          className={cn(
            "tap-target flex items-center justify-center rounded-xl px-3 backdrop-blur",
            micMuted ? "bg-amber-500/80 text-white" : "bg-black/50 text-white",
          )}
          aria-label={micMuted ? "Microphone muted" : "Microphone live"}
        >
          {micMuted ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
        </span>
      </div>
    </div>
  );
}
