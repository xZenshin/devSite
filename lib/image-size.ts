import { open } from "node:fs/promises";

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Reads the pixel size from a PNG or JPEG header, so a frame can match its
 * image without dimensions in the frontmatter. Returns undefined for other
 * formats or unreadable files.
 */
export async function readImageSize(file: string): Promise<ImageSize | undefined> {
  let handle;
  try {
    handle = await open(file, "r");
    // JPEG dimensions sit after the EXIF block, which can be large.
    const buffer = Buffer.alloc(256 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return parseImageSize(buffer.subarray(0, bytesRead));
  } catch {
    return undefined;
  } finally {
    await handle?.close();
  }
}

export function parseImageSize(bytes: Buffer): ImageSize | undefined {
  // PNG: signature, then the IHDR chunk with width and height.
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.toString("ascii", 12, 16) === "IHDR") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  // JPEG: walk the segments until a start-of-frame marker.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return undefined;
      const marker = bytes[offset + 1];
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      offset += 2 + bytes.readUInt16BE(offset + 2);
    }
  }
  return undefined;
}
