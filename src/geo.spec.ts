import { describe, expect, it } from "vite-plus/test";
import { toGeoJson, toKml } from "./geo";

const placemarks = [
  { title: "A & B.jpg", url: "https://x/A", latitude: 50.06, longitude: 19.93 },
];

describe("geo exports", () => {
  it("writes KML with escaped names, longitude first", () => {
    const kml = toKml("Holiday", placemarks);
    expect(kml).toContain("<name>A &amp; B.jpg</name>");
    expect(kml).toContain("<coordinates>19.93,50.06</coordinates>");
  });

  it("writes GeoJSON points", () => {
    expect(toGeoJson(placemarks).features[0]!.geometry.coordinates).toEqual([
      19.93, 50.06,
    ]);
  });
});
