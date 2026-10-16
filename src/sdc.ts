import { useDebounceFn } from "@vueuse/core";
import { shallowRef } from "vue";
import {
  MAX_CAPTION,
  parseCaptions,
  splitItems,
  type Defaults,
  type Meta,
} from "./meta";
import { apiPost, type Auth } from "./upload";
import { effectiveMeta, ownWorkAuthor } from "./wikitext";
import type { Wiki } from "./wiki";

type Snak = {
  snaktype: "value" | "somevalue";
  property: string;
  datavalue?: { type: string; value: unknown };
};

const item = (property: string, id: string): Snak => ({
  snaktype: "value",
  property,
  datavalue: {
    type: "wikibase-entityid",
    value: { "entity-type": "item", id },
  },
});
const string = (property: string, value: string): Snak => ({
  snaktype: "value",
  property,
  datavalue: { type: "string", value },
});

export interface Statement {
  mainsnak: Snak;
  qualifiers?: Snak[];
}

/** License templates (in the license wikitext) → Wikidata items. */
const LICENSES: [RegExp, string][] = [
  [/\bcc-by-sa-4\.0\b/i, "Q18199165"],
  [/\bcc-by-4\.0\b/i, "Q20007257"],
  [/\bcc-by-sa-3\.0\b/i, "Q14946043"],
  [/\bcc-by-3\.0\b/i, "Q14947546"],
  [/\bcc-zero\b|\bcc0\b/i, "Q6938433"],
];
const CC0 = "Q6938433";
/** copyright status: copyrighted, or dedicated to the public domain */
const COPYRIGHTED = "Q50423863";
const DEDICATED_TO_PD = "Q88088423";
/** source of file: original creation by uploader */
const OWN_WORK = "Q66458942";

/** Wikibase time value of `YYYY`, `YYYY-MM` or `YYYY-MM-DD…`. */
export function timeValue(date: string) {
  const match = date.trim().match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return {
    time: `+${year}-${month ?? "00"}-${day ?? "00"}T00:00:00Z`,
    precision: day ? 11 : month ? 10 : 9,
    timezone: 0,
    before: 0,
    after: 0,
    calendarmodel: "http://www.wikidata.org/entity/Q1985727",
  };
}

/**
 * Statements derived from the metadata, as OpenRefine/UploadWizard add them:
 * depicts (P180), inception (P571) from the date, coordinates of the point of
 * view (P1259) with heading (P7787), copyright license (P275) and status
 * (P6216) for known licenses, and for own work: source of file (P7482) and
 * creator (P170, unknown value qualified with the uploader).
 */
export function statements(
  meta: Meta,
  defaults: Defaults,
  username?: string,
): Statement[] {
  const m = effectiveMeta(meta, defaults, username);
  const result: Statement[] = splitItems(m.depicts).map((id) => ({
    mainsnak: item("P180", id),
  }));
  const time = timeValue(m.date);
  if (time)
    result.push({
      mainsnak: {
        snaktype: "value",
        property: "P571",
        datavalue: { type: "time", value: time },
      },
    });
  const [lat, lon, heading] = [m.latitude, m.longitude, m.heading].map((v) =>
    v.trim() === "" ? NaN : Number(v),
  );
  if (Math.abs(lat!) <= 90 && Math.abs(lon!) <= 180)
    result.push({
      mainsnak: {
        snaktype: "value",
        property: "P1259",
        datavalue: {
          type: "globecoordinate",
          value: {
            latitude: lat,
            longitude: lon,
            precision: 0.000001,
            globe: "http://www.wikidata.org/entity/Q2",
          },
        },
      },
      ...(Number.isFinite(heading)
        ? {
            qualifiers: [
              {
                snaktype: "value",
                property: "P7787",
                datavalue: {
                  type: "quantity",
                  value: {
                    amount: `${heading! < 0 ? "" : "+"}${heading}`,
                    unit: "http://www.wikidata.org/entity/Q28390",
                  },
                },
              },
            ],
          }
        : {}),
    });
  const licenses = LICENSES.filter(([re]) => re.test(m.license)).map(
    ([, id]) => id,
  );
  for (const id of licenses) result.push({ mainsnak: item("P275", id) });
  if (licenses.length)
    result.push({
      mainsnak: item(
        "P6216",
        licenses.every((id) => id === CC0) ? DEDICATED_TO_PD : COPYRIGHTED,
      ),
    });
  const ownWork =
    /^\{\{\s*own\s*\}\}$/i.test(m.source) &&
    !!username &&
    m.author === ownWorkAuthor(username);
  if (ownWork) {
    result.push({ mainsnak: item("P7482", OWN_WORK) });
    result.push({
      mainsnak: { snaktype: "somevalue", property: "P170" },
      qualifiers: [
        string("P2093", username),
        string("P4174", username),
        string(
          "P2699",
          `https://commons.wikimedia.org/wiki/User:${encodeURIComponent(username.replaceAll(" ", "_"))}`,
        ),
      ],
    });
  }
  return result;
}

/** Statement in the `wbeditentity` format. */
function claim({ mainsnak, qualifiers }: Statement) {
  return {
    type: "statement",
    rank: "normal",
    mainsnak,
    ...(qualifiers
      ? {
          qualifiers: Object.fromEntries(
            qualifiers.map((q) => [q.property, [q]]),
          ),
          "qualifiers-order": qualifiers.map((q) => q.property),
        }
      : {}),
  };
}

/**
 * Structured data of a file for `wbeditentity`: the caption as label in the
 * description language and statements, those only where they refer to
 * Wikidata items. `undefined` if there is nothing to save.
 */
export function structuredData(
  meta: Meta,
  defaults: Defaults,
  wiki: Wiki,
  username?: string,
): object | undefined {
  if (!wiki.mediainfo) return undefined;
  const captions = parseCaptions(meta.caption, defaults.language);
  const claims = wiki.wikidata
    ? statements(meta, defaults, username).map(claim)
    : [];
  const valid = Object.entries(captions).filter(
    ([, text]) => text.length <= MAX_CAPTION,
  );
  const labels = valid.length
    ? Object.fromEntries(
        valid.map(([language, value]) => [language, { language, value }]),
      )
    : undefined;
  if (!labels && !claims.length) return undefined;
  return {
    ...(labels ? { labels } : {}),
    ...(claims.length ? { claims } : {}),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Save structured data of an uploaded file. The MediaInfo ID is `M` + page
 * ID, looked up with a few retries: replicas may lag behind the upload.
 */
export async function saveStructuredData(
  title: string,
  data: object,
  { token, summary }: { token: string; summary: string },
  auth: Auth,
): Promise<void> {
  let pageid: number | undefined;
  for (let attempt = 0; !pageid && attempt < 5; attempt++) {
    if (attempt) await sleep(2000 * attempt);
    const json = await apiPost<{
      query: { pages: { pageid?: number }[] };
    }>({ action: "query", titles: `File:${title}`, prop: "info" }, auth);
    pageid = json.query.pages[0]?.pageid;
  }
  if (!pageid) throw new Error(`File:${title} not found`);
  await apiPost(
    {
      action: "wbeditentity",
      id: `M${pageid}`,
      data: JSON.stringify(data),
      summary,
      token,
    },
    auth,
  );
}

/** Wikidata items matching a text, as `[id, label, description]`. */
export async function searchItems(
  text: string,
  language: string,
): Promise<[string, string, string][]> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbsearchentities",
    format: "json",
    formatversion: "2",
    origin: "*",
    type: "item",
    search: text,
    language,
    uselang: language,
    limit: "10",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json: {
    search: { id: string; label?: string; description?: string }[];
  } = await res.json();
  return json.search.map((r) => [r.id, r.label ?? "", r.description ?? ""]);
}

/**
 * Suggestions for a depicts input, as complete input values for a
 * `<datalist>`: the last, partly typed entry is replaced by matching items.
 */
export function useItemSuggestions() {
  const options = shallowRef<{ value: string; label: string }[]>([]);
  let request = 0;
  const search = useDebounceFn(async (value: string, language: string) => {
    const current = ++request;
    const parts = value.split(";");
    const typed = parts.pop()!.trim();
    const before = parts.map((p) => p.trim()).filter(Boolean);
    const prefix = before.length ? `${before.join("; ")}; ` : "";
    const found =
      typed.length >= 2 && !/^Q\d+$/i.test(typed)
        ? await searchItems(typed, language || "en")
        : [];
    if (current !== request) return;
    options.value = found
      .filter(([id]) => !before.includes(id))
      .map(([id, label, description]) => ({
        value: prefix + id,
        label: [label, description].filter(Boolean).join(" – "),
      }));
  }, 200);

  function suggest(value: string, language: string) {
    search(value, language).catch(console.warn);
  }
  return { options, suggest };
}

/** Value of a snak as text, with a link for items. */
export function snakText(snak: Snak): { text: string; href?: string } {
  const value = snak.datavalue?.value as Record<string, unknown> | string;
  if (!snak.datavalue) return { text: "?" };
  switch (snak.datavalue.type) {
    case "wikibase-entityid": {
      const id = (value as { id: string }).id;
      return { text: id, href: `https://www.wikidata.org/wiki/${id}` };
    }
    case "time": {
      const { time, precision } = value as { time: string; precision: number };
      return {
        text: time.slice(1, precision === 9 ? 5 : precision === 10 ? 8 : 11),
      };
    }
    case "globecoordinate": {
      const { latitude, longitude } = value as Record<string, number>;
      return { text: `${latitude}, ${longitude}` };
    }
    case "quantity":
      return { text: `${+(value as { amount: string }).amount}°` };
    default:
      return {
        text: typeof value === "string" ? value : JSON.stringify(value),
      };
  }
}
