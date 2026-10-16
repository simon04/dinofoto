import { describe, expect, it } from "vite-plus/test";
import { emptyMeta, initialDefaults, invalidItems, splitItems } from "./meta";
import { structuredData } from "./sdc";
import { COMMONS, WIKIS } from "./wiki";

const defaults = initialDefaults("de");

describe("structuredData", () => {
  it("has the caption as label and depicts statements", () => {
    expect(
      structuredData(
        { ...emptyMeta(), caption: " Tuchhallen ", depicts: "Q1; q2, Q1" },
        defaults,
        COMMONS,
      ),
    ).toEqual({
      labels: { de: { language: "de", value: "Tuchhallen" } },
      claims: ["Q1", "Q2"].map((id) => ({
        type: "statement",
        rank: "normal",
        mainsnak: {
          snaktype: "value",
          property: "P180",
          datavalue: {
            type: "wikibase-entityid",
            value: { "entity-type": "item", id },
          },
        },
      })),
    });
  });

  it("is empty without values, or without MediaInfo", () => {
    expect(structuredData(emptyMeta(), defaults, COMMONS)).toBeUndefined();
    const testwiki = WIKIS.find((w) => w.id === "testwiki")!;
    expect(
      structuredData({ ...emptyMeta(), caption: "x" }, defaults, testwiki),
    ).toBeUndefined();
  });

  it("leaves out Wikidata statements on Test Commons", () => {
    const testcommons = WIKIS.find((w) => w.id === "testcommons")!;
    expect(
      structuredData(
        { ...emptyMeta(), caption: "x", depicts: "Q1" },
        defaults,
        testcommons,
      ),
    ).toEqual({ labels: { de: { language: "de", value: "x" } } });
  });
});

describe("items", () => {
  it("splits and validates item IDs", () => {
    expect(splitItems("Q42; q5 Q42")).toEqual(["Q42", "Q5"]);
    expect(invalidItems("Q42; Douglas Adams")).toEqual(["Douglas", "Adams"]);
  });
});
