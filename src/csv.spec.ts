import { describe, expect, it } from "vite-plus/test";
import { emptyMeta } from "./meta";
import {
  columnOf,
  detectDelimiter,
  formatDelimited,
  parseDelimited,
  readTable,
  writeTable,
} from "./csv";

describe("parseDelimited", () => {
  it("parses quoted cells with delimiters, quotes and newlines", () => {
    expect(parseDelimited('a,"b,c","say ""hi""","x\ny"\r\n1,2,3,4\n')).toEqual([
      ["a", "b,c", 'say "hi"', "x\ny"],
      ["1", "2", "3", "4"],
    ]);
  });

  it("detects tabs and semicolons", () => {
    expect(detectDelimiter("a\tb,c")).toBe("\t");
    expect(detectDelimiter("a;b;c,d")).toBe(";");
    expect(detectDelimiter("a,b")).toBe(",");
  });

  it("skips empty lines", () => {
    expect(parseDelimited("a\n\n\nb\n", ",")).toEqual([["a"], ["b"]]);
  });

  it("round-trips", () => {
    const rows = [["a", "b,c", 'q"', "x\ny", ""]];
    expect(parseDelimited(formatDelimited(rows))).toEqual(rows);
  });
});

describe("readTable", () => {
  it("matches columns by header", () => {
    const table = readTable(
      "File;Title;Description;Lat;Unknown\nIMG_1.jpg;Market Square;{{en|1=Houses}};50.06;x\n",
    );
    expect(table.unknown).toEqual(["Unknown"]);
    expect(table.rows).toEqual([
      {
        file: "IMG_1.jpg",
        values: {
          title: "Market Square",
          description: "{{en|1=Houses}}",
          latitude: "50.06",
        },
      },
    ]);
  });

  it("takes columns in order without header", () => {
    expect(readTable("A\tB\nC\tD", "description").rows).toEqual([
      { values: { description: "A", caption: "B" } },
      { values: { description: "C", caption: "D" } },
    ]);
  });

  it("knows aliases", () => {
    expect(columnOf(" Lng ")).toBe("longitude");
    expect(columnOf("path")).toBe("file");
    expect(columnOf("nope")).toBeUndefined();
  });

  it("reads what writeTable writes", () => {
    const meta = { ...emptyMeta(), title: "A, B", categories: "X; Y" };
    const csv = writeTable([{ path: "dir/a.jpg", meta }]);
    expect(readTable(csv).rows[0]).toEqual({
      file: "dir/a.jpg",
      values: { ...emptyMeta(), title: "A, B", categories: "X; Y" },
    });
  });
});
