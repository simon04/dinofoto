import { describe, expect, it } from "vite-plus/test";
import {
  emptyMeta,
  formatCaptions,
  initialDefaults,
  invalidItems,
  parseCaptions,
  splitItems,
} from "./meta";
import { captionsFromDescription } from "./pattern";
import { quickStatements, statements, structuredData, timeValue } from "./sdc";
import { COMMONS, WIKIS } from "./wiki";

// no license: only the statements under test
const defaults = { ...initialDefaults("de"), license: "", source: "" };

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

describe("statements", () => {
  const meta = {
    ...emptyMeta(),
    date: "2012-06-15 10:00:00",
    latitude: "50.0617",
    longitude: "19.9373",
    heading: "45",
  };
  const props = (list: { mainsnak: { property: string } }[]) =>
    list.map((s) => s.mainsnak.property);

  it("derives inception, point of view, license and own work", () => {
    const list = statements(meta, initialDefaults("en"), "Yarl");
    expect(props(list)).toEqual([
      "P571",
      "P1259",
      "P275",
      "P6216",
      "P7482",
      "P170",
    ]);
    expect(list[1]!.qualifiers?.[0]?.datavalue?.value).toEqual({
      amount: "+45",
      unit: "http://www.wikidata.org/entity/Q28390",
    });
    expect(list[5]).toMatchObject({
      mainsnak: { snaktype: "somevalue", property: "P170" },
      qualifiers: [
        { property: "P2093", datavalue: { value: "Yarl" } },
        { property: "P4174", datavalue: { value: "Yarl" } },
        {
          property: "P2699",
          datavalue: { value: "https://commons.wikimedia.org/wiki/User:Yarl" },
        },
      ],
    });
  });

  it("has no creator for other authors and maps CC0", () => {
    const list = statements(
      { ...meta, author: "Jane", license: "{{cc-zero}}" },
      initialDefaults("en"),
      "Yarl",
    );
    expect(props(list)).toEqual(["P571", "P1259", "P275", "P6216"]);
    expect(list[3]!.mainsnak.datavalue?.value).toMatchObject({
      id: "Q88088423",
    });
  });

  it("parses dates with year, month or day precision", () => {
    expect(timeValue("2012")).toMatchObject({
      time: "+2012-00-00T00:00:00Z",
      precision: 9,
    });
    expect(timeValue("2012-06")).toMatchObject({ precision: 10 });
    expect(timeValue("circa 2012")).toBeUndefined();
  });
});

describe("captions", () => {
  it("parses one or several languages", () => {
    expect(parseCaptions("Tuchhallen", "de")).toEqual({ de: "Tuchhallen" });
    expect(parseCaptions("en: Cloth Hall | DE: Tuchhallen", "pl")).toEqual({
      en: "Cloth Hall",
      de: "Tuchhallen",
    });
    expect(formatCaptions({ en: "A", de: "B" })).toBe("en: A | de: B");
  });

  it("are derived from descriptions with language templates", () => {
    expect(
      captionsFromDescription(
        "{{en|1=The [[Cloth Hall]]}} {{de|Tuchhallen}}",
        250,
      ),
    ).toEqual({ en: "The Cloth Hall", de: "Tuchhallen" });
    expect(captionsFromDescription("x".repeat(300), 10)).toEqual({
      "": "xxxxxxxxx…",
    });
  });

  it("become labels per language", () => {
    expect(
      structuredData(
        { ...emptyMeta(), caption: "en: Cloth Hall | de: Tuchhallen" },
        defaults,
        COMMONS,
      ),
    ).toEqual({
      labels: {
        en: { language: "en", value: "Cloth Hall" },
        de: { language: "de", value: "Tuchhallen" },
      },
    });
  });
});

describe("quickStatements", () => {
  it("writes captions, statements and qualifiers", () => {
    const list = statements(
      {
        ...emptyMeta(),
        depicts: "Q943",
        date: "2012-06",
        latitude: "50.06",
        longitude: "19.93",
        heading: "45",
      },
      { ...initialDefaults("en"), license: "" },
      "Yarl",
    );
    expect(quickStatements("M5", { en: 'A "b"' }, list)).toEqual([
      'M5\tLen\t"A \\"b\\""',
      "M5\tP180\tQ943",
      "M5\tP571\t+2012-06-00T00:00:00Z/10",
      "M5\tP1259\t@50.06/19.93\tP7787\t+45U28390",
      "M5\tP7482\tQ66458942",
      'M5\tP170\tsomevalue\tP2093\t"Yarl"\tP4174\t"Yarl"\tP2699\t"https://commons.wikimedia.org/wiki/User:Yarl"',
    ]);
  });
});

describe("object location", () => {
  it("adds coordinates of the depicted place", () => {
    const list = statements(
      { ...emptyMeta(), objectLatitude: "50.06", objectLongitude: "19.93" },
      { ...initialDefaults("en"), license: "", source: "" },
    );
    expect(list.map((s) => s.mainsnak.property)).toEqual(["P9149"]);
  });
});
