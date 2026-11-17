import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseImageSize, readImageSize } from "./image-size";

describe("image size", () => {
  it("reads a PNG from public", async () => {
    const file = path.join(process.cwd(), "public", "projects", "rep-tracker", "logging.png");
    expect(await readImageSize(file)).toEqual({ width: 502, height: 848 });
  });

  it("reads a JPEG start-of-frame after other segments", () => {
    const bytes = Buffer.from([
      0xff, 0xd8, // start of image
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 segment, 2 bytes of payload
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x02, 0x58, 0x03, // SOF0: 300 high, 600 wide
    ]);
    expect(parseImageSize(bytes)).toEqual({ width: 600, height: 300 });
  });

  it("returns undefined for other formats and missing files", async () => {
    expect(parseImageSize(Buffer.from("GIF89a........"))).toBeUndefined();
    expect(await readImageSize(path.join(process.cwd(), "public", "missing.png"))).toBeUndefined();
  });
});
