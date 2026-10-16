/** A located file for map exports. */
export interface Placemark {
  title: string;
  url: string;
  latitude: number;
  longitude: number;
}

const escape = (text: string) =>
  text.replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!,
  );

/** KML document with a placemark per file, e.g. for Google Earth or JOSM. */
export function toKml(name: string, placemarks: Placemark[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>${escape(name)}</name>
${placemarks
  .map(
    (p) => `<Placemark>
<name>${escape(p.title)}</name>
<description>${escape(p.url)}</description>
<Point><coordinates>${p.longitude},${p.latitude}</coordinates></Point>
</Placemark>`,
  )
  .join("\n")}
</Document>
</kml>
`;
}

/** GeoJSON feature collection of the files. */
export function toGeoJson(placemarks: Placemark[]) {
  return {
    type: "FeatureCollection",
    features: placemarks.map((p) => ({
      type: "Feature",
      properties: { name: p.title, url: p.url },
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
    })),
  };
}
