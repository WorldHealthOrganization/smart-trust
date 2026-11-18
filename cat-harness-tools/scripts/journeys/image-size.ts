/**
 * The pixel size of a PNG or JPEG file, read from its header: no decoder, no
 * dependency. Used by the Table sheets view to give a canvas preview its
 * intrinsic size (so the page never stretches it past its pixels), and by
 * `check:journey-refs` to say when a preview is too coarse for its paper.
 *
 * @module scripts/journeys/image-size
 */
import { closeSync, openSync, readSync } from "node:fs";

export interface ImageSize {
  width: number;
  height: number;
}

/** The size from the first bytes of a PNG or JPEG, or undefined for anything else (or a truncated header). */
export function imageSizeOf(b: Uint8Array): ImageSize | undefined {
  const at16 = (i: number) => (b[i]! << 8) | b[i + 1]!;
  const at32 = (i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
  // PNG: the signature, then the IHDR chunk's width and height.
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[12] === 0x49 && b[13] === 0x48 && b[14] === 0x44 && b[15] === 0x52) {
    return { width: at32(16), height: at32(20) };
  }
  // JPEG: walk the segments to the first start-of-frame (SOF0–SOF15, not DHT, JPG or DAC).
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return undefined;
      const m = b[i + 1]!;
      if (m === 0xff) {
        i++;
        continue;
      }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: at16(i + 7), height: at16(i + 5) };
      i += 2 + at16(i + 2);
    }
  }
  return undefined;
}

/** The size of an image file on disk, reading only its head (64 KiB covers a JPEG's metadata before its frame). */
export function imageSize(path: string): ImageSize | undefined {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const buf = new Uint8Array(65536);
    const n = readSync(fd, buf, 0, buf.length, 0);
    return imageSizeOf(buf.subarray(0, n));
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** The long side of a sheet, in inches: what a preview's pixels are spread over when printed. */
const LONG_SIDE_IN: Record<"A3" | "A4", number> = { A3: 420 / 25.4, A4: 297 / 25.4 };

/** Below this many pixels per inch of paper a preview is soft on screen once the page shows it at full width. */
export const SHARP_DPI = 200;

/** The preview's resolution over its sheet's long side, in dots per inch. */
export function previewDpi(size: ImageSize, paper: "A3" | "A4"): number {
  return Math.max(size.width, size.height) / LONG_SIDE_IN[paper];
}
