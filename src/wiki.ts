import { useLocalStorage } from "@vueuse/core";
import { computed } from "vue";

/** A wiki to upload to. */
export interface Wiki {
  id: string;
  host: string;
  /** structured data: captions (Wikibase MediaInfo) */
  mediainfo: boolean;
  /** statements refer to Wikidata items */
  wikidata: boolean;
}

export const COMMONS: Wiki = {
  id: "commons",
  host: "commons.wikimedia.org",
  mediainfo: true,
  wikidata: true,
};

/**
 * Upload targets: Commons, and test wikis to try a batch without
 * publishing it. OAuth 2.0 tokens are valid on all Wikimedia wikis.
 */
export const WIKIS: Wiki[] = [
  COMMONS,
  // structured data with test.wikidata.org items, needs autoconfirmed
  {
    id: "testcommons",
    host: "test-commons.wikimedia.org",
    mediainfo: true,
    wikidata: false,
  },
  // uploads for every logged-in user
  {
    id: "testwiki",
    host: "test.wikipedia.org",
    mediainfo: false,
    wikidata: false,
  },
];

const targetId = useLocalStorage("dinofoto.target", COMMONS.id);

/** The wiki files are uploaded to. */
export const target = computed<Wiki>({
  get: () => WIKIS.find((w) => w.id === targetId.value) ?? COMMONS,
  set: (wiki) => {
    targetId.value = wiki.id;
  },
});

export const apiUrl = (wiki: Wiki = COMMONS) =>
  `https://${wiki.host}/w/api.php`;

export const fileUrl = (title: string, wiki: Wiki = COMMONS) =>
  `https://${wiki.host}/wiki/File:${encodeURIComponent(title.replaceAll(" ", "_"))}`;
