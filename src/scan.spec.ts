import { describe, expect, it } from "vite-plus/test";
import { extension, isImage, sha1 } from "./scan";
import { pool } from "./pool";

describe("isImage", () => {
  it.each([
    ["IMG_5612.JPG", true],
    ["photo.jpeg", true],
    ["scan.tif", true],
    ["drawing.svg", true],
    ["notes.txt", false],
    ["video.mp4", false],
    [".jpg", false],
    ["jpg", false],
  ])("%s → %s", (name, expected) => {
    expect(isImage(name)).toBe(expected);
  });

  it("lowercases the extension", () => {
    expect(extension("A.B.JPG")).toBe("jpg");
  });
});

describe("sha1", () => {
  it("hashes as lowercase hex", async () => {
    expect(await sha1(new Blob(["abc"]))).toBe(
      "a9993e364706816aba3e25717850c26c9cd0d89d",
    );
  });
});

describe("pool", () => {
  it("limits concurrency and processes all items", async () => {
    let running = 0;
    let max = 0;
    const done: number[] = [];
    await pool([1, 2, 3, 4, 5], 2, async (n) => {
      max = Math.max(max, ++running);
      await new Promise((r) => setTimeout(r, 5));
      done.push(n);
      running--;
    });
    expect(max).toBe(2);
    expect(done.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});
