/**
 * Audio capture worklet.
 *
 * Its only job is to forward raw mono Float32 frames to the main thread, which
 * downsamples them and encodes complete WAV files.
 *
 * This replaces MediaRecorder.start(timeslice). That API looks like it gives
 * you a stream of uploadable audio files, and it does not: only the first
 * emitted Blob carries the container header. Chunks 2..N are raw Matroska
 * cluster continuations and are not decodable on their own, so every chunk
 * after the first was rejected or garbled by the transcription API. Capturing
 * PCM and building WAV ourselves means every chunk is a complete, valid file
 * with no container state carried between them.
 */
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.muted = false;
    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.muted === "boolean") {
        this.muted = event.data.muted;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    // While muted we keep the graph alive but emit nothing at all — "off
    // record" must mean no audio leaves the device, not audio that is captured
    // and then discarded somewhere downstream.
    if (!this.muted) {
      // Copy: the underlying buffer is reused by the audio thread.
      this.port.postMessage(new Float32Array(channel));
    }

    return true;
  }
}

registerProcessor("recorder-processor", RecorderProcessor);
