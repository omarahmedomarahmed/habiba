/**
 * Browser-side session recorder.
 *
 * Captures microphone audio, downsamples to 16 kHz mono, and emits a complete
 * WAV file every `chunkSeconds`. Each file is independently decodable, which is
 * the whole point — see the note in `public/audio-recorder.worklet.js`.
 *
 * Client-only module: it is imported from a `"use client"` component and never
 * evaluated on the server.
 */

const TARGET_SAMPLE_RATE = 16_000;

export type RecorderOptions = {
  chunkSeconds?: number;
  onChunk: (chunk: { blob: Blob; durationSeconds: number; sequence: number }) => void;
  onError?: (error: Error) => void;
  onLevel?: (level: number) => void;
};

export class SessionRecorder {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  private buffer: Float32Array[] = [];
  private bufferedFrames = 0;
  private sequence = 0;
  private muted = false;

  private readonly chunkSeconds: number;
  private readonly onChunk: RecorderOptions["onChunk"];
  private readonly onError?: RecorderOptions["onError"];
  private readonly onLevel?: RecorderOptions["onLevel"];

  constructor(options: RecorderOptions) {
    // Eight seconds rather than five: fewer round trips, better transcription
    // accuracy (more context per request), and still well inside any
    // serverless body limit at roughly 256 KB per chunk.
    this.chunkSeconds = options.chunkSeconds ?? 8;
    this.onChunk = options.onChunk;
    this.onError = options.onError;
    this.onLevel = options.onLevel;
  }

  get isRecording(): boolean {
    return this.context !== null;
  }

  async start(): Promise<void> {
    if (this.context) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const context = new AudioContext();
    // Safari starts contexts suspended until a user gesture resumes them.
    if (context.state === "suspended") await context.resume();

    await context.audioWorklet.addModule("/audio-recorder.worklet.js");

    const source = context.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(context, "recorder-processor");

    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.push(event.data, context.sampleRate);
    };

    source.connect(node);
    // Not connected to the destination: routing the microphone to the speakers
    // would produce feedback in the room.

    this.context = context;
    this.source = source;
    this.node = node;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.node?.port.postMessage({ muted });
    if (muted) {
      // Flush what has been captured so far rather than letting it straddle the
      // pause and arrive out of order later.
      this.flush();
    }
  }

  async stop(): Promise<void> {
    this.flush();
    this.node?.port.close();
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed") {
      await this.context.close().catch(() => {});
    }
    this.context = null;
    this.node = null;
    this.source = null;
    this.stream = null;
    this.buffer = [];
    this.bufferedFrames = 0;
  }

  private push(frames: Float32Array, sampleRate: number): void {
    if (this.muted) return;

    if (this.onLevel) {
      let peak = 0;
      for (let i = 0; i < frames.length; i += 16) {
        const value = Math.abs(frames[i]!);
        if (value > peak) peak = value;
      }
      this.onLevel(peak);
    }

    this.buffer.push(frames);
    this.bufferedFrames += frames.length;

    if (this.bufferedFrames >= sampleRate * this.chunkSeconds) {
      this.flush(sampleRate);
    }
  }

  private flush(sampleRate?: number): void {
    const rate = sampleRate ?? this.context?.sampleRate ?? 48_000;
    if (this.bufferedFrames === 0) return;

    // A fragment shorter than a second is almost always the tail of a pause and
    // transcribes to noise or a stock hallucinated phrase.
    if (this.bufferedFrames < rate * 1) {
      this.buffer = [];
      this.bufferedFrames = 0;
      return;
    }

    const merged = new Float32Array(this.bufferedFrames);
    let offset = 0;
    for (const part of this.buffer) {
      merged.set(part, offset);
      offset += part.length;
    }
    this.buffer = [];
    this.bufferedFrames = 0;

    const downsampled = downsample(merged, rate, TARGET_SAMPLE_RATE);
    const blob = encodeWav(downsampled, TARGET_SAMPLE_RATE);

    this.sequence += 1;
    try {
      this.onChunk({
        blob,
        durationSeconds: downsampled.length / TARGET_SAMPLE_RATE,
        sequence: this.sequence,
      });
    } catch (error) {
      this.onError?.(error instanceof Error ? error : new Error("chunk handler failed"));
    }
  }
}

/** Simple averaging decimator. Adequate for speech at 48k → 16k. */
function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return input;
  const ratio = from / to;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j]!;
    output[i] = sum / Math.max(1, end - start);
  }

  return output;
}

/** 16-bit mono PCM WAV. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
