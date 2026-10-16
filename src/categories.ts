import { useDebounceFn } from "@vueuse/core";
import { shallowRef } from "vue";
import { apiGet } from "./commons";
import { t } from "./i18n";

const strip = (title: string) => title.replace(/^Category:/, "");

/** Commons categories starting with `prefix` (without `Category:`). */
export async function searchCategories(prefix: string): Promise<string[]> {
  if (!prefix.trim()) return [];
  const [, titles] = await apiGet<[string, string[]]>({
    action: "opensearch",
    namespace: "14",
    search: prefix.trim(),
    limit: "10",
  });
  return titles.map(strip);
}

const nearby = new Map<string, Promise<string[]>>();

/**
 * Visible categories of Commons files within 300 m, most frequent first.
 * Categories with a year (e.g. `September 2012 in Kraków`) belong to the
 * dates of those files and are left out.
 */
export function nearbyCategories(lat: number, lon: number): Promise<string[]> {
  // ~100 m grid, so neighbouring photos share the request
  const key = `${lat.toFixed(3)}|${lon.toFixed(3)}`;
  let result = nearby.get(key);
  if (!result) {
    result = fetchNearby(key).catch(() => []);
    nearby.set(key, result);
  }
  return result;
}

async function fetchNearby(coord: string): Promise<string[]> {
  const json = await apiGet<{
    query?: { pages: { categories?: { title: string }[] }[] };
  }>({
    action: "query",
    generator: "geosearch",
    ggscoord: coord,
    ggsradius: "300",
    ggsnamespace: "6",
    ggslimit: "50",
    prop: "categories",
    clshow: "!hidden",
    cllimit: "max",
  });
  const counts = new Map<string, number>();
  for (const page of json.query?.pages ?? [])
    for (const { title } of page.categories ?? [])
      counts.set(strip(title), (counts.get(strip(title)) ?? 0) + 1);
  return [...counts]
    .filter(([title]) => !/\b(1[0-9]|20)\d\d\b/.test(title))
    .sort((a, b) => b[1] - a[1])
    .map(([title]) => title)
    .slice(0, 15);
}

/** Those of the categories that do not exist on Commons. */
export async function missingCategories(names: string[]): Promise<Set<string>> {
  const missing = new Set<string>();
  const unique = [...new Set(names)];
  for (let i = 0; i < unique.length; i += 50) {
    const json = await apiGet<{
      query: {
        pages: { title: string; missing?: boolean; invalid?: boolean }[];
        normalized?: { from: string; to: string }[];
      };
    }>({
      action: "query",
      titles: unique
        .slice(i, i + 50)
        .map((name) => `Category:${name}`)
        .join("|"),
    });
    const missingTitles = new Set(
      json.query.pages
        .filter((page) => page.missing || page.invalid)
        .map((page) => page.title),
    );
    const normalized = new Map(
      json.query.normalized?.map(({ from, to }) => [from, to]),
    );
    for (const name of unique.slice(i, i + 50)) {
      const title = `Category:${name}`;
      if (missingTitles.has(normalized.get(title) ?? title)) missing.add(name);
    }
  }
  return missing;
}

/**
 * Suggestions for a `;`-separated category input, as complete input values
 * for a `<datalist>`: matching categories for the last, partly typed one,
 * else categories of nearby files.
 */
const keywordCache = new Map<string, Promise<boolean>>();

/** Those keywords of a photo that are Commons categories. */
export async function keywordCategories(keywords: string[]): Promise<string[]> {
  const unchecked = keywords.filter((k) => !keywordCache.has(k));
  if (unchecked.length) {
    const missing = missingCategories(unchecked).catch(
      () => new Set(unchecked),
    );
    for (const k of unchecked)
      keywordCache.set(
        k,
        missing.then((m) => !m.has(k)),
      );
  }
  const exists = await Promise.all(keywords.map((k) => keywordCache.get(k)!));
  return keywords.filter((_, i) => exists[i]);
}

export function useCategorySuggestions() {
  const options = shallowRef<{ value: string; label: string }[]>([]);
  let request = 0;

  const search = useDebounceFn(
    async (value: string, coords?: [number, number], keywords?: string[]) => {
      const current = ++request;
      const parts = value.split(";");
      const typed = parts.pop()!.trim();
      const before = parts.map((p) => p.trim()).filter(Boolean);
      const prefix = before.length ? `${before.join("; ")}; ` : "";
      const found: [string, string][] =
        typed.length >= 2
          ? (await searchCategories(typed)).map((name) => [name, name])
          : [
              // keywords of the photo first: chosen by the photographer
              ...(keywords?.length
                ? await keywordCategories(keywords)
                : []
              ).map((name): [string, string] => [
                name,
                `${name} (${t("categories-keyword")})`,
              ]),
              ...(coords ? await nearbyCategories(...coords) : []).map(
                (name): [string, string] => [
                  name,
                  `${name} (${t("categories-nearby")})`,
                ],
              ),
            ];
      if (current !== request) return;
      const seen = new Set(before);
      options.value = found
        .filter(([name]) => !seen.has(name) && seen.add(name))
        .map(([name, label]) => ({ value: prefix + name, label }));
    },
    200,
  );

  /** Update the suggestions for an input value and its photo's location and keywords. */
  function suggest(
    value: string,
    latitude = "",
    longitude = "",
    keywords?: string[],
  ) {
    const located = latitude.trim() !== "" && longitude.trim() !== "";
    const coords: [number, number] | undefined =
      located && isFinite(+latitude) && isFinite(+longitude)
        ? [+latitude, +longitude]
        : undefined;
    search(value, coords, keywords).catch(console.warn);
  }

  return { options, suggest };
}
