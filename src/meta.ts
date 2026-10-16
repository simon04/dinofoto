/** Editable metadata of a picture, all wikitext. */
export interface Meta {
  /** target file name without extension */
  title: string;
  description: string;
  date: string;
  /** separated by `;` or newlines, without `Category:` */
  categories: string;
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
  "date",
  "categories",
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
  date: "",
  categories: "",
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
