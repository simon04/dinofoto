import { splitCategories, type Defaults, type Meta } from "./meta";
import { extension } from "./scan";

/** Author for own work: a link to the user page of the uploader. */
export function ownWorkAuthor(username?: string): string {
  return username ? `[[User:${username}|${username}]]` : "";
}

/** Commons title of a picture: edited name plus the original extension. */
export function fileTitle(meta: Meta, path: string): string {
  const name = meta.title.replace(/[\s_]+/g, " ").trim();
  return `${name}.${extension(path)}`;
}

/** Title as normalized by MediaWiki: first letter uppercase, no `_`. */
export function normalizeTitle(title: string): string {
  const t = title.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const isNumber = (value: string) =>
  value.trim() !== "" && Number.isFinite(Number(value));

/** The values used for upload: per-file values, else the defaults. */
export function effectiveMeta(
  meta: Meta,
  defaults: Defaults,
  username?: string,
): Meta {
  return {
    ...meta,
    description: meta.description.trim() || defaults.description.trim(),
    categories: [
      ...new Set([
        ...splitCategories(defaults.categories),
        ...splitCategories(meta.categories),
      ]),
    ].join("; "),
    author:
      meta.author.trim() || defaults.author.trim() || ownWorkAuthor(username),
    source: meta.source.trim() || defaults.source.trim(),
    license: meta.license.trim() || defaults.license.trim(),
  };
}

/** Description wrapped in a language template, unless it has one. */
export function describe(description: string, language: string): string {
  const text = description.trim();
  if (!text || !language.trim() || text.startsWith("{{")) return text;
  return `{{${language.trim()}|1=${text}}}`;
}

/** File description page with {{Information}}, {{Location}}, license and categories. */
export function pageText(
  meta: Meta,
  defaults: Defaults,
  username?: string,
): string {
  const m = effectiveMeta(meta, defaults, username);
  const lines = [
    "=={{int:filedesc}}==",
    "{{Information",
    `|description=${describe(m.description, defaults.language)}`,
    `|date=${m.date.trim()}`,
    `|source=${m.source}`,
    `|author=${m.author}`,
    "|permission=",
    "|other versions=",
    "}}",
  ];
  if (isNumber(m.latitude) && isNumber(m.longitude)) {
    const heading = isNumber(m.heading) ? `|heading:${+m.heading}` : "";
    lines.push(`{{Location|${+m.latitude}|${+m.longitude}${heading}}}`);
  }
  lines.push("", "=={{int:license-header}}==", m.license, "");
  for (const category of splitCategories(m.categories))
    lines.push(`[[Category:${category}]]`);
  return lines.join("\n").trimEnd() + "\n";
}

export type Problem =
  | "title-empty"
  | "title-chars"
  | "title-long"
  | "title-extension"
  | "title-duplicate"
  | "title-exists"
  | "title-camera"
  | "license-missing"
  | "author-missing"
  | "source-missing"
  | "description-missing"
  | "date-missing"
  | "categories-missing"
  | "location-invalid";

/** Problems that prevent the upload; others are warnings. */
export const ERRORS = new Set<Problem>([
  "title-empty",
  "title-chars",
  "title-long",
  "title-duplicate",
  "title-exists",
  "license-missing",
  "author-missing",
  "source-missing",
]);

/** Names given by cameras and phones, discouraged on Commons. */
const CAMERA_NAME =
  /^(IMG|DSC|DSCN|DSCF|DSC_|PICT|P\d{3}|CIMG|SAM|IMAG|GOPR|DJI|PXL|MVIMG|Photo)[ _-]?[\d_ -]+$/i;

/** Problems of one picture's metadata (without checks against others). */
export function problems(
  meta: Meta,
  path: string,
  defaults: Defaults,
  username?: string,
): Problem[] {
  const m = effectiveMeta(meta, defaults, username);
  const name = meta.title.trim();
  const result: Problem[] = [];
  if (!name) result.push("title-empty");
  // characters MediaWiki and Commons upload rules forbid
  // eslint-disable-next-line no-control-regex
  if (/[#<>[\]|{}/:\\]|~{3}|[\x00-\x1f\x7f]/.test(name))
    result.push("title-chars");
  if (new TextEncoder().encode(fileTitle(meta, path)).length > 240)
    result.push("title-long");
  if (/\.(jpe?g|png|gif|tiff?|webp|svg)$/i.test(name))
    result.push("title-extension");
  if (CAMERA_NAME.test(name)) result.push("title-camera");
  if (!m.license) result.push("license-missing");
  if (!m.author) result.push("author-missing");
  if (!m.source) result.push("source-missing");
  if (!m.description) result.push("description-missing");
  if (!m.date.trim()) result.push("date-missing");
  if (!m.categories) result.push("categories-missing");
  if (
    (m.latitude.trim() || m.longitude.trim()) &&
    !(
      isNumber(m.latitude) &&
      isNumber(m.longitude) &&
      Math.abs(+m.latitude) <= 90 &&
      Math.abs(+m.longitude) <= 180
    )
  )
    result.push("location-invalid");
  return result;
}
