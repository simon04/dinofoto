import { useDebounceFn } from "@vueuse/core";
import { shallowRef } from "vue";
import { MAX_CAPTION, splitItems, type Defaults, type Meta } from "./meta";
import { apiPost, type Auth } from "./upload";
import type { Wiki } from "./wiki";

/** depicts */
const P180 = "P180";

/**
 * Structured data of a file for `wbeditentity`: the caption as label in the
 * description language and depicts (P180) statements; statements only where
 * they refer to Wikidata items. `undefined` if there is nothing to save.
 */
export function structuredData(
  meta: Meta,
  defaults: Defaults,
  wiki: Wiki,
): object | undefined {
  if (!wiki.mediainfo) return undefined;
  const caption = meta.caption.trim();
  const language = defaults.language.trim();
  const items = wiki.wikidata ? splitItems(meta.depicts) : [];
  const labels =
    caption && language && caption.length <= MAX_CAPTION
      ? { [language]: { language, value: caption } }
      : undefined;
  if (!labels && !items.length) return undefined;
  return {
    ...(labels ? { labels } : {}),
    ...(items.length
      ? {
          claims: items.map((id) => ({
            type: "statement",
            rank: "normal",
            mainsnak: {
              snaktype: "value",
              property: P180,
              datavalue: {
                type: "wikibase-entityid",
                value: { "entity-type": "item", id },
              },
            },
          })),
        }
      : {}),
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
