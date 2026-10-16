const API = "https://commons.wikimedia.org/w/api.php";

/** Anonymous GET to the Commons Action API. */
export async function apiGet<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API);
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

export const fileUrl = (title: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replaceAll(" ", "_"))}`;

/** Titles (without `File:`, normalized) of these files that exist on Commons. */
export async function existingFiles(titles: string[]): Promise<Set<string>> {
  const existing = new Set<string>();
  for (let i = 0; i < titles.length; i += 50) {
    const json = await apiGet<{
      query: {
        pages: { title: string; missing?: boolean; invalid?: boolean }[];
      };
    }>({
      action: "query",
      titles: titles
        .slice(i, i + 50)
        .map((title) => `File:${title}`)
        .join("|"),
    });
    for (const page of json.query.pages)
      if (!page.missing && !page.invalid)
        existing.add(page.title.replace(/^File:/, ""));
  }
  return existing;
}

/** HTML of wikitext rendered as a file description page. */
export async function parse(text: string, title: string): Promise<string> {
  const res = await fetch(API, {
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
