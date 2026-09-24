/**
 * 🔴 W1-17: cutting a WAV at the consent boundary, with no audio tools.
 *
 * There is no ffmpeg on this platform, and the transcription model returns
 * text without timestamps, so neither "cut the audio" nor "drop the segments
 * before the offset" is available for a compressed container. PCM in a RIFF
 * WAV is the exception: its bytes are the samples, so a cut at a time is a cut
 * at `seconds * byteRate`, rounded down to a whole frame, with the header
 * rewritten to the new length. That is exact, and it happens BEFORE anything
 * is sent to the transcriber.
 *
 * Pure, so the arithmetic is tested without a database or a model.
 */

export type WavInfo = {
  /** Where the sample data starts, and how long it is, in bytes. */
  dataOffset: number;
  dataLength: number;
  byteRate: number;
  blockAlign: number;
  durationSeconds: number;
};

/** Reads a RIFF/WAVE header with PCM data, or returns null for anything else. */
export function wavInfo(buffer: Buffer): WavInfo | null {
  if (buffer.length < 12) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }

  let byteRate = 0;
  let blockAlign = 0;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      if (body + 16 > buffer.length) return null;
      // Plain PCM or float only: an extensible or compressed WAV is not cut here.
      if (![1, 3].includes(buffer.readUInt16LE(body))) return null;
      byteRate = buffer.readUInt32LE(body + 8);
      blockAlign = buffer.readUInt16LE(body + 12);
    } else if (id === "data") {
      if (!byteRate || !blockAlign) return null;
      const dataLength = Math.min(size, buffer.length - body);
      return {
        dataOffset: body,
        dataLength,
        byteRate,
        blockAlign,
        durationSeconds: dataLength / byteRate,
      };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

/**
 * Drop the first `seconds` of a WAV. Returns a new, well-formed WAV (a
 * canonical 44 byte header over the kept samples), or null when nothing is
 * left or the input is not a WAV this can read.
 */
export function dropWavStart(buffer: Buffer, seconds: number): Buffer | null {
  const info = wavInfo(buffer);
  if (!info) return null;
  if (seconds <= 0) return buffer;

  const cut = Math.ceil((seconds * info.byteRate) / info.blockAlign) * info.blockAlign;
  if (cut >= info.dataLength) return null;

  const kept = buffer.subarray(info.dataOffset + cut, info.dataOffset + info.dataLength);
  const fmtAt = buffer.indexOf("fmt ", 12, "ascii");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + kept.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  // Format, channels, sample rate, byte rate, block align, bits: copied as sent.
  buffer.copy(header, 20, fmtAt + 8, fmtAt + 24);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(kept.length, 40);
  return Buffer.concat([header, kept]);
}

/** Whether a content type says WAV. */
export function isWavType(contentType: string): boolean {
  return /^audio\/(wav|wave|x-wav|vnd\.wave)\b/i.test(contentType);
}
