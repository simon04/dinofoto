import { describe, expect, it } from "vite-plus/test";
import { emptyMeta } from "./meta";
import { applyPattern, plainText } from "./pattern";

const meta = {
  ...emptyMeta(),
  title: "IMG 5612",
  date: "2012-06-15 10:00:00",
  description: "{{en|1=Houses in [[Kraków|Old Town]]}}",
};

describe("applyPattern", () => {
  it("numbers with zero padding", () => {
    expect(applyPattern("Market Square ({nn})", 7, meta, "a.jpg")).toBe(
      "Market Square (07)",
    );
    expect(applyPattern("{n}-{nnn}", 12, meta, "a.jpg")).toBe("12-012");
  });

  it("inserts metadata and path parts", () => {
    expect(
      applyPattern(
        "{folder} {date} {description} – {file} ({title})",
        1,
        meta,
        "2012/Kraków/IMG_5612.JPG",
      ),
    ).toBe("Kraków 2012-06-15 Houses in Old Town – IMG_5612 (IMG 5612)");
  });

  it("collapses whitespace of empty values", () => {
    expect(applyPattern("A {folder} {date} B", 1, emptyMeta(), "x.jpg")).toBe(
      "A B",
    );
  });
});

describe("plainText", () => {
  it("strips templates, links and formatting", () => {
    expect(
      plainText("{{de|1='''Dom''' von [https://x.org Wien]}} {{Q|1}}"),
    ).toBe("Dom von Wien");
  });
});
