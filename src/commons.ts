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

/**
 * Of these files (titles without `File:`, normalized): those that exist on
 * the wiki, and those protected against creation.
 */
export async function fileStatus(
  titles: string[],
  wiki: Wiki = COMMONS,
): Promise<{ existing: Set<string>; protected: Set<string> }> {
  const existing = new Set<string>();
  const protectedTitles = new Set<string>();
  for (let i = 0; i < titles.length; i += 50) {
    const json = await apiGet<{
      query: {
        pages: {
          title: string;
          missing?: boolean;
          invalid?: boolean;
          protection?: { type: string }[];
        }[];
      };
    }>(
      {
        action: "query",
        prop: "info",
        inprop: "protection",
        titles: titles
          .slice(i, i + 50)
          .map((title) => `File:${title}`)
          .join("|"),
      },
      wiki,
    );
    for (const page of json.query.pages) {
      const title = page.title.replace(/^File:/, "");
      if (!page.missing && !page.invalid) existing.add(title);
      if (page.protection?.some((p) => ["create", "upload"].includes(p.type)))
        protectedTitles.add(title);
    }
  }
  return { existing, protected: protectedTitles };
}

/**
 * Reason why the title blacklist forbids uploading a file of this name
 * (`action=titleblacklist`), as text; `undefined` if allowed.
 */
export async function titleBlacklist(
  title: string,
  wiki: Wiki = COMMONS,
): Promise<string | undefined> {
  const json = await apiGet<{
    titleblacklist: { result: string; reason?: string; message?: string };
  }>(
    {
      action: "titleblacklist",
      tbaction: "upload",
      tbtitle: `File:${title}`,
    },
    wiki,
  ).catch(() => undefined);
  const result = json?.titleblacklist;
  if (!result || result.result === "ok") return undefined;
  return result.reason
    ? (new DOMParser().parseFromString(result.reason, "text/html").body
        .textContent ?? result.message)
    : result.message;
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
