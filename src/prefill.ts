import type { Defaults, Meta } from "./meta";

/** URL parameters for the defaults, as in UploadWizard. */
const DEFAULTS: Record<string, keyof Defaults> = {
  description: "description",
  descriptionlang: "language",
  language: "language",
  categories: "categories",
  author: "author",
  source: "source",
  license: "license",
};

/** URL parameters prefilling each new file. */
const FILE_FIELDS: Record<string, keyof Meta> = {
  caption: "caption",
  depicts: "depicts",
  lat: "latitude",
  lon: "longitude",
  heading: "heading",
};

/**
 * Prefill from URL parameters, e.g.
 * `?categories=Wiki Loves Monuments 2026|Kraków&lat=50.06&lon=19.93`;
 * `|` separates categories as in UploadWizard.
 */
export function prefillFromUrl(search: string): {
  defaults: Partial<Defaults>;
  meta: Partial<Meta>;
} {
  const params = new URLSearchParams(search);
  const defaults: Partial<Defaults> = {};
  const meta: Partial<Meta> = {};
  for (const [param, value] of params) {
    const v = param === "categories" ? value.split("|").join("; ") : value;
    if (param in DEFAULTS) defaults[DEFAULTS[param]!] = v;
    else if (param in FILE_FIELDS)
      (meta as Record<string, string>)[FILE_FIELDS[param]!] = v;
  }
  // UploadWizard's caption language
  if (params.has("captionlang") && meta.caption)
    meta.caption = `${params.get("captionlang")}: ${meta.caption}`;
  return { defaults, meta };
}
