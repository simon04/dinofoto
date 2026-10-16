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
export async function readExif(
  file: File,
): Promise<Pick<Meta, "date" | "latitude" | "longitude" | "heading">> {
  const exif: {
    DateTimeOriginal?: Date;
    CreateDate?: Date;
    latitude?: number;
    longitude?: number;
    GPSImgDirection?: number;
  } =
    (await exifr
      .parse(file, {
        gps: true,
        xmp: false,
        icc: false,
        iptc: false,
        interop: false,
        ifd1: false,
      })
      .catch(() => undefined)) ?? {};
  const date = exif.DateTimeOriginal ?? exif.CreateDate;
  const located =
    Number.isFinite(exif.latitude) && Number.isFinite(exif.longitude);
  return {
    date: date instanceof Date && !isNaN(+date) ? formatDate(date) : "",
    latitude: located ? round(exif.latitude!, 6) : "",
    longitude: located ? round(exif.longitude!, 6) : "",
    heading:
      located && Number.isFinite(exif.GPSImgDirection)
        ? round(exif.GPSImgDirection!, 1)
        : "",
  };
}
