import exifr from "exifr";
import type { Meta } from "./meta";

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD HH:MM:SS`, as accepted by {{Information}}. */
export function formatDate(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const round = (n: number, digits: number) => String(+n.toFixed(digits));

/** Date taken, location and camera heading from EXIF. */
/** Decimal degrees of EXIF degrees/minutes/seconds and a reference (S, W negative). */
export function degrees(dms?: number[] | number, ref?: string) {
  const [d = NaN, m = 0, s = 0] = typeof dms === "number" ? [dms] : (dms ?? []);
  const value = d + m / 60 + s / 3600;
  if (!Number.isFinite(value)) return undefined;
  return /^[SW]/i.test(ref ?? "") ? -value : value;
}

/** Text of an XMP/IPTC value: plain, language alternatives or a list. */
function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return text(value[0]);
  if (value && typeof value === "object" && "value" in value)
    return text((value as { value: unknown }).value);
  return "";
}

/** Descriptions cameras write by themselves, e.g. `OLYMPUS DIGITAL CAMERA`. */
const CAMERA_TEXT =
  /^(OLYMPUS DIGITAL CAMERA|SONY DSC|DIGITAL CAMERA|KODAK.*CAMERA|Default|Untitled|Screenshot|DCIM.*|[A-Z0-9_ -]*(DSC|IMG|CAMERA)[A-Z0-9_ -]*)$/i;
const useful = (value: string) =>
  value && !CAMERA_TEXT.test(value) ? value : "";

/** Metadata of a photo from EXIF, IPTC and XMP. */
export interface PhotoMetadata extends Pick<
  Meta,
  | "date"
  | "latitude"
  | "longitude"
  | "heading"
  | "objectLatitude"
  | "objectLongitude"
> {
  /** title (IPTC object name, XMP `dc:title`) */
  title: string;
  /** description (XMP `dc:description`, IPTC caption, EXIF) */
  description: string;
  /** keywords (IPTC, XMP `dc:subject`) */
  keywords: string[];
}

export async function readExif(file: File): Promise<PhotoMetadata> {
  const exif: {
    DateTimeOriginal?: Date;
    CreateDate?: Date;
    latitude?: number;
    longitude?: number;
    GPSImgDirection?: number;
    GPSDestBearing?: number;
    GPSDestLatitude?: number[];
    GPSDestLatitudeRef?: string;
    GPSDestLongitude?: number[];
    GPSDestLongitudeRef?: string;
    ImageDescription?: unknown;
    ObjectName?: unknown;
    Caption?: unknown;
    Keywords?: unknown;
    title?: unknown;
    description?: unknown;
    subject?: unknown;
  } =
    (await exifr
      .parse(file, {
        gps: true,
        xmp: true,
        iptc: true,
        icc: false,
        interop: false,
        ifd1: false,
      })
      .catch(() => undefined)) ?? {};
  const date = exif.DateTimeOriginal ?? exif.CreateDate;
  const located =
    Number.isFinite(exif.latitude) && Number.isFinite(exif.longitude);
  const direction = Number.isFinite(exif.GPSImgDirection)
    ? exif.GPSImgDirection
    : exif.GPSDestBearing;
  const objectLat = degrees(exif.GPSDestLatitude, exif.GPSDestLatitudeRef);
  const objectLon = degrees(exif.GPSDestLongitude, exif.GPSDestLongitudeRef);
  const keywords = [exif.Keywords, exif.subject]
    .flatMap((k) => (Array.isArray(k) ? k : k ? [k] : []))
    .map(text)
    .filter(Boolean);
  return {
    date: date instanceof Date && !isNaN(+date) ? formatDate(date) : "",
    latitude: located ? round(exif.latitude!, 6) : "",
    longitude: located ? round(exif.longitude!, 6) : "",
    // direction of the camera, else towards the photographed object
    heading: located && Number.isFinite(direction) ? round(direction!, 1) : "",
    objectLatitude: objectLat === undefined ? "" : round(objectLat, 6),
    objectLongitude: objectLon === undefined ? "" : round(objectLon, 6),
    title: useful(text(exif.title) || text(exif.ObjectName)),
    description: useful(
      text(exif.description) ||
        text(exif.Caption) ||
        text(exif.ImageDescription),
    ),
    keywords: [...new Set(keywords)],
  };
}
