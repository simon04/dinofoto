import type { Meta } from "./meta";

/** Placeholders of file name patterns. */
export const PLACEHOLDERS = [
  "{n}",
  "{nn}",
  "{nnn}",
  "{title}",
  "{file}",
  "{folder}",
  "{date}",
  "{description}",
];

/** Text of wikitext, e.g. `{{en|1=[[Kraków|Old Town]]}}` → `Old Town`. */
export function plainText(wikitext: string): string {
  return wikitext
    .replace(
      /\{\{\s*[a-z]{2,3}(?:-[a-z]+)*\s*\|\s*(?:1\s*=)?\s*([^{}]*)\}\}/gi,
      "$1",
    )
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[\S+\s([^\]]*)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * File name from a pattern such as `Kraków – Market Square ({nn})` for the
 * `n`-th file: `{n}`, `{nn}`, `{nnn}` count (zero-padded), `{title}` is the
 * current name, `{file}` the original name, `{folder}` its directory,
 * `{date}` the day taken and `{description}` the description as text.
 */
export function applyPattern(
  pattern: string,
  n: number,
  meta: Meta,
  path: string,
): string {
  const parts = path.split("/");
  const name = parts.pop()!;
  const values: Record<string, string> = {
    title: meta.title,
    file: name.slice(0, name.lastIndexOf(".")),
    folder: parts.pop() ?? "",
    date: meta.date.trim().slice(0, 10),
    description: plainText(meta.description),
  };
  return pattern
    .replace(/\{(n+)\}/g, (_, digits: string) =>
      String(n).padStart(digits.length, "0"),
    )
    .replace(
      /\{(title|file|folder|date|description)\}/g,
      (_, key: string) => values[key]!,
    )
    .replace(/\s+/g, " ")
    .trim();
}
