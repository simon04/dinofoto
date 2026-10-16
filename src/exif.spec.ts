import { describe, expect, it } from "vite-plus/test";
import { degrees } from "./exif";

describe("degrees", () => {
  it("converts degrees, minutes, seconds with reference", () => {
    expect(degrees([50, 3, 36], "N")).toBeCloseTo(50.06);
    expect(degrees([19, 56, 0], "W")).toBeCloseTo(-19.9333, 4);
    expect(degrees(undefined)).toBeUndefined();
  });
});
