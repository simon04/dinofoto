import { describe, expect, it } from "vite-plus/test";
import { emptyMeta, initialDefaults, splitCategories } from "./meta";
import { fileTitle, normalizeTitle, pageText, problems } from "./wikitext";

const defaults = { ...initialDefaults("en"), categories: "Squares" };
const meta = {
  ...emptyMeta(),
  title: "Kraków  - Market_Square (01)",
  description: "Houses in Old Town",
  date: "2012-06-15 10:00:00",
  categories: "Category:Old Town Market Square in Kraków; [[Squares]]",
  latitude: "50.061389",
  longitude: "19.937222",
  heading: "45",
};

describe("pageText", () => {
  it("builds {{Information}}, {{Location}}, license and categories", () => {
    expect(pageText(meta, defaults, "Yarl")).toBe(
      `=={{int:filedesc}}==
{{Information
|description={{en|1=Houses in Old Town}}
|date=2012-06-15 10:00:00
|source={{own}}
|author=[[User:Yarl|Yarl]]
|permission=
|other versions=
}}
{{Location|50.061389|19.937222|heading:45}}

=={{int:license-header}}==
{{self|cc-by-sa-4.0}}

[[Category:Squares]]
[[Category:Old Town Market Square in Kraków]]
`,
    );
  });

  it("keeps descriptions with templates and per-file values", () => {
    const text = pageText(
      {
        ...meta,
        description: "{{de|1=Häuser}}",
        author: "Jane",
        license: "{{cc-zero}}",
        latitude: "",
      },
      defaults,
      "Yarl",
    );
    expect(text).toContain("|description={{de|1=Häuser}}\n");
    expect(text).toContain("|author=Jane\n");
    expect(text).toContain("\n{{cc-zero}}\n");
    expect(text).not.toContain("{{Location");
  });
});

describe("titles", () => {
  it("adds the extension and collapses whitespace", () => {
    expect(fileTitle(meta, "a/IMG_5612.JPG")).toBe(
      "Kraków - Market Square (01).jpg",
    );
    expect(normalizeTitle("foo_bar.jpg")).toBe("Foo bar.jpg");
  });
});

describe("problems", () => {
  it("finds none for complete metadata", () => {
    expect(problems(meta, "a.jpg", defaults, "Yarl")).toEqual([]);
  });

  it("reports invalid and missing values", () => {
    expect(
      problems(
        { ...emptyMeta(), title: "IMG_1234", latitude: "north" },
        "a.jpg",
        { ...defaults, categories: "", license: "", source: "" },
      ),
    ).toEqual([
      "title-camera",
      "license-missing",
      "author-missing",
      "source-missing",
      "description-missing",
      "date-missing",
      "categories-missing",
      "location-invalid",
    ]);
    expect(
      problems({ ...meta, title: "a/b [c]" }, "a.jpg", defaults, "Y"),
    ).toEqual(["title-chars"]);
  });
});

describe("splitCategories", () => {
  it("strips prefixes and brackets", () => {
    expect(splitCategories("[[Category:A_b]];\n category:C ;;")).toEqual([
      "A b",
      "C",
    ]);
  });
});

describe("UploadWizard title rules", () => {
  it.each([
    ["120px-Foo", "title-chars"],
    ["Foo‎Bar", "title-chars"],
    ["It''s", "title-chars"],
    ["Abc", "title-short"],
    ["x".repeat(240), "title-long"],
    ["PANA 1234", "title-camera"],
  ])("%s → %s", (title, problem) => {
    expect(problems({ ...meta, title }, "a.jpg", defaults, "Y")).toContain(
      problem,
    );
  });
});
