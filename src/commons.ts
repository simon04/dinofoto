import { apiUrl, COMMONS, type Wiki } from "./wiki";

export { fileUrl } from "./wiki";

/** Anonymous GET to the Action API of Commons (or another wiki). */
export async function apiGet<T>(
  params: Record<string, string>,
  wiki: Wiki = COMMONS,
): Promise<T> {
  const url = new URL(apiUrl(wiki));
  url.search = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/** Title (without `File:`) of a Commons file with this SHA-1, if any. */
export async function findBySha1(sha1: string): Promise<string | undefined> {
  const json = await apiGet<{ query: { allimages: { name: string }[] } }>({
    action: "query",
    list: "allimages",
    aisha1: sha1,
    aiprop: "",
    ailimit: "1",
  });
  return json.query.allimages[0]?.name;
}

/** Titles (without `File:`, normalized) of these files that exist on the wiki. */
export async function existingFiles(
  titles: string[],
  wiki: Wiki = COMMONS,
): Promise<Set<string>> {
  const existing = new Set<string>();
  for (let i = 0; i < titles.length; i += 50) {
    const json = await apiGet<{
      query: {
        pages: { title: string; missing?: boolean; invalid?: boolean }[];
      };
    }>(
      {
        action: "query",
        titles: titles
          .slice(i, i + 50)
          .map((title) => `File:${title}`)
          .join("|"),
      },
      wiki,
    );
    for (const page of json.query.pages)
      if (!page.missing && !page.invalid)
        existing.add(page.title.replace(/^File:/, ""));
  }
  return existing;
}

/** HTML of wikitext rendered as a file description page. */
export async function parse(text: string, title: string): Promise<string> {
  const res = await fetch(apiUrl(), {
    method: "POST",
    body: new URLSearchParams({
      action: "parse",
      format: "json",
      formatversion: "2",
      origin: "*",
      text,
      title: `File:${title}`,
      contentmodel: "wikitext",
      prop: "text|categories",
      pst: "1",
      disablelimitreport: "1",
      uselang: "en",
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json: { parse: { text: string } } = await res.json();
  return json.parse.text;
}
