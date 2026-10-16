import { reactive } from "vue";
import { useDebounceFn } from "@vueuse/core";

/** Labels of Wikidata items by ID, in the language of `labelLanguage`. */
const labels = reactive(new Map<string, string>());
const requested = new Set<string>();
let pending = new Set<string>();
let labelLanguage = "en";

const fetchPending = useDebounceFn(async () => {
  const ids = [...pending];
  pending = new Set();
  for (let i = 0; i < ids.length; i += 50) {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.search = new URLSearchParams({
      action: "wbgetentities",
      format: "json",
      formatversion: "2",
      origin: "*",
      ids: ids.slice(i, i + 50).join("|"),
      props: "labels",
      languages: labelLanguage,
      languagefallback: "1",
    }).toString();
    const res = await fetch(url).catch(() => undefined);
    if (!res?.ok) continue;
    const json: {
      entities: Record<string, { labels?: Record<string, { value: string }> }>;
    } = await res.json();
    for (const [id, entity] of Object.entries(json.entities)) {
      const label = Object.values(entity.labels ?? {})[0]?.value;
      if (label) labels.set(id, label);
    }
  }
}, 100);

/**
 * Label of a Wikidata item, fetched in batches on first use; the ID until
 * loaded.
 */
export function itemLabel(id: string, language: string): string {
  if (language !== labelLanguage) {
    labelLanguage = language;
    labels.clear();
    requested.clear();
  }
  if (!requested.has(id)) {
    requested.add(id);
    pending.add(id);
    fetchPending().catch(console.warn);
  }
  return labels.get(id) ?? id;
}
