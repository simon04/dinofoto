/** Editable metadata of a picture, all wikitext. */
export interface Meta {
  /** target file name without extension */
  title: string;
  description: string;
  /** short plain-text label in the description language (structured data) */
  caption: string;
  date: string;
  /** separated by `;` or newlines, without `Category:` */
  categories: string;
  /** Wikidata items shown, e.g. `Q1234; Q5` (structured data) */
  depicts: string;
  latitude: string;
  longitude: string;
  /** camera heading in degrees */
  heading: string;
  author: string;
  source: string;
  license: string;
  /** excluded from the upload */
  skip?: boolean;
}

export type Field = Exclude<keyof Meta, "skip">;

/** Columns in table and CSV order. */
export const FIELDS: Field[] = [
  "title",
  "description",
  "caption",
  "date",
  "categories",
  "depicts",
  "latitude",
  "longitude",
  "heading",
  "author",
  "source",
  "license",
];

/** Fields with a default value for all pictures. */
export interface Defaults {
  /** language of descriptions without a language template */
  language: string;
  description: string;
  categories: string;
  author: string;
  source: string;
  license: string;
}

export const DEFAULT_FIELDS = [
  "description",
  "categories",
  "author",
  "source",
  "license",
] as const satisfies (Field & keyof Defaults)[];

export const LICENSES = [
  "{{self|cc-by-sa-4.0}}",
  "{{self|cc-by-4.0}}",
  "{{self|cc-zero}}",
  "{{self|cc-by-sa-4.0|GFDL}}",
];

export const emptyMeta = (): Meta => ({
  title: "",
  description: "",
  caption: "",
  date: "",
  categories: "",
  depicts: "",
  latitude: "",
  longitude: "",
  heading: "",
  author: "",
  source: "",
  license: "",
});

export const initialDefaults = (language: string): Defaults => ({
  language,
  description: "",
  categories: "",
  author: "",
  source: "{{own}}",
  license: LICENSES[0]!,
});

/** Categories of a `;`/newline separated list, without `Category:`. */
export function splitCategories(value: string): string[] {
  return value
    .split(/[;\n]/)
    .map((c) =>
      c
        .trim()
        .replace(/^\[\[|\]\]$/g, "")
        .replace(/^:?category:/i, "")
        .replace(/_/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

/** Wikidata item IDs in a `;`/space separated list, e.g. `Q1234; Q5`. */
export function splitItems(value: string): string[] {
  return [...new Set(value.match(/\bQ\d+\b/gi) ?? [])].map((id) =>
    id.toUpperCase(),
  );
}

/** Entries of a depicts list that are no item IDs. */
export function invalidItems(value: string): string[] {
  return value
    .split(/[;,\s]+/)
    .map((v) => v.trim())
    .filter((v) => v && !/^Q\d+$/i.test(v));
}

/** Captions are limited by Wikibase MediaInfo. */
export const MAX_CAPTION = 250;
