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
