import { FIELDS, type Field, type Meta } from "./meta";

/** Delimiter of pasted text: tab (spreadsheets), else `;` or `,`. */
export function detectDelimiter(text: string): string {
  const line = text.split("\n", 1)[0] ?? "";
  if (line.includes("\t")) return "\t";
  const count = (c: string) => line.split(c).length;
  return count(";") > count(",") ? ";" : ",";
}

/** Parse CSV/TSV with RFC 4180 quoting; empty lines are skipped. */
export function parseDelimited(
  text: string,
  delimiter = detectDelimiter(text),
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

/** Format rows as CSV (or TSV), quoting where needed. */
export function formatDelimited(rows: string[][], delimiter = ","): string {
  const quote = (value: string) =>
    /["\n\r]/.test(value) || value.includes(delimiter)
      ? `"${value.replaceAll('"', '""')}"`
      : value;
  return rows.map((row) => row.map(quote).join(delimiter)).join("\n") + "\n";
}

/** Column with the original file path, to match rows to pictures. */
export const FILE_COLUMN = "file";

const ALIASES: Record<string, Field | typeof FILE_COLUMN> = {
  file: FILE_COLUMN,
  path: FILE_COLUMN,
  original: FILE_COLUMN,
  filename: "title",
  name: "title",
  "file name": "title",
  desc: "description",
  category: "categories",
  lat: "latitude",
  lon: "longitude",
  lng: "longitude",
  direction: "heading",
  objectlatitude: "objectLatitude",
  objectlongitude: "objectLongitude",
  "object latitude": "objectLatitude",
  "object longitude": "objectLongitude",
  "object lat": "objectLatitude",
  "object lon": "objectLongitude",
  permission: "license",
};

/** Field of a header cell (field name or alias, case-insensitive). */
export function columnOf(
  header: string,
): Field | typeof FILE_COLUMN | undefined {
  const key = header.trim().toLowerCase();
  return FIELDS.find((f) => f === key) ?? ALIASES[key];
}

export interface Row {
  file?: string;
  values: Partial<Record<Field, string>>;
}

export interface Table {
  rows: Row[];
  /** header cells not matching any field */
  unknown: string[];
}

/**
 * Rows of a pasted table. With a header row, columns are matched by name;
 * without, they are taken in table order, starting at `startField`.
 */
export function readTable(text: string, startField: Field = FIELDS[0]!): Table {
  const cells = parseDelimited(text);
  const header = cells[0]?.map(columnOf) ?? [];
  const hasHeader = header.some((c) => c !== undefined);
  const columns = hasHeader ? header : FIELDS.slice(FIELDS.indexOf(startField));
  const unknown = hasHeader
    ? cells[0]!.filter((_, i) => header[i] === undefined)
    : [];
  const rows = (hasHeader ? cells.slice(1) : cells).map((cellsOfRow) => {
    const row: Row = { values: {} };
    cellsOfRow.forEach((value, i) => {
      const column = columns[i];
      if (column === FILE_COLUMN) row.file = value.trim();
      else if (column) row.values[column] = value.trim();
    });
    return row;
  });
  return { rows, unknown };
}

/** Table of the given pictures with all fields, for export. */
export function writeTable(
  photos: { path: string; meta: Meta }[],
  delimiter = ",",
): string {
  return formatDelimited(
    [
      [FILE_COLUMN, ...FIELDS],
      ...photos.map(({ path, meta }) => [path, ...FIELDS.map((f) => meta[f])]),
    ],
    delimiter,
  );
}
