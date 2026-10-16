import { createGlobalState, useLocalStorage } from "@vueuse/core";
import { computed, ref, shallowRef, watch } from "vue";
import { useAuth } from "./auth";
import { fileStatus, findBySha1, titleBlacklist } from "./commons";
import type { Table } from "./csv";
import { missingCategories } from "./categories";
import { readExif } from "./exif";
import { target } from "./wiki";
import { language } from "./i18n";
import {
  emptyMeta,
  initialDefaults,
  splitCategories,
  type Defaults,
  type Meta,
} from "./meta";
import { pool } from "./pool";
import { prefillFromUrl } from "./prefill";
import { fileKey, scanDirectory, sha1 } from "./scan";
import {
  effectiveMeta,
  ERRORS,
  MAX_SIZE,
  fileTitle,
  normalizeTitle,
  pageText,
  problems,
  type Problem,
} from "./wikitext";

export type Status =
  /** waiting to be hashed */
  | "queued"
  | "hashing"
  /** not on Commons yet */
  | "new"
  /** a file with the same SHA-1 is on Commons */
  | "exists"
  /** same content as another file of this directory */
  | "duplicate"
  | "error";

export interface Photo {
  /** path relative to the opened directory */
  path: string;
  file: File;
  sha1?: string;
  status: Status;
  /** title of the identical file on Commons */
  existing?: string;
  error?: string;
}

/** A picture selected for upload, with the resulting page. */
export interface Item {
  photo: Photo;
  meta: Meta;
  /** categories that do not exist on Commons */
  unknownCategories: string[];
  /** parameters of problem messages, e.g. the blacklist reason */
  details: Partial<Record<Problem, string>>;
  /** Commons title without `File:` */
  title: string;
  text: string;
  problems: Problem[];
  /** has problems that prevent the upload */
  invalid: boolean;
}

export const usePhotos = createGlobalState(() => {
  const directory = shallowRef<FileSystemDirectoryHandle>();
  const photos = ref<Photo[]>([]);
  const scanning = ref(false);
  /** SHA-1 by path, size and modification time, to skip re-hashing */
  const hashes = useLocalStorage<Record<string, string>>("dinofoto.sha1", {});
  /** metadata by SHA-1, kept across reloads and directories */
  const meta = useLocalStorage<Record<string, Meta>>("dinofoto.meta", {});
  // fields added later: stored metadata gets them empty
  for (const [sha1, m] of Object.entries(meta.value))
    meta.value[sha1] = { ...emptyMeta(), ...m };
  const defaults = useLocalStorage<Defaults>(
    "dinofoto.defaults",
    initialDefaults(language.value),
    { mergeDefaults: true },
  );
  // defaults and values for new files from the URL, e.g. ?categories=…
  const prefill = prefillFromUrl(location.search);
  Object.assign(defaults.value, prefill.defaults);
  let generation = 0;

  async function open() {
    const dir = await window.showDirectoryPicker({ id: "dinofoto" });
    const current = ++generation;
    directory.value = dir;
    photos.value = [];
    scanning.value = true;
    try {
      const files = await scanDirectory(dir);
      if (current !== generation) return;
      photos.value = files.map(({ path, file }) => ({
        path,
        file,
        status: "queued",
      }));
      const seen = new Map<string, Photo>();
      // reading files is the bottleneck, Commons requests are cheap
      await pool(photos.value, 4, async (photo) => {
        if (current !== generation) return;
        await check(photo, seen);
      });
    } finally {
      if (current === generation) scanning.value = false;
    }
  }

  async function check(photo: Photo, seen: Map<string, Photo>) {
    try {
      const key = fileKey(photo.path, photo.file);
      if (!hashes.value[key]) {
        photo.status = "hashing";
        hashes.value[key] = await sha1(photo.file);
      }
      photo.sha1 = hashes.value[key];
      if (seen.has(photo.sha1)) {
        photo.status = "duplicate";
        photo.existing = seen.get(photo.sha1)!.path;
        return;
      }
      seen.set(photo.sha1, photo);
      photo.existing = await findBySha1(photo.sha1);
      if (!photo.existing) await initMeta(photo, photo.sha1);
      photo.status = photo.existing ? "exists" : "new";
    } catch (e) {
      photo.status = "error";
      photo.error = String(e);
    }
  }

  /** Metadata from the file name and EXIF, unless edited before. */
  async function initMeta(photo: Photo, sha1: string) {
    if (meta.value[sha1]) return;
    const name = photo.path.split("/").pop()!;
    const { title, ...exif } = await readExif(photo.file);
    meta.value[sha1] = {
      ...emptyMeta(),
      ...exif,
      // the URL may set values the photo lacks
      ...Object.fromEntries(
        Object.entries(prefill.meta).filter(
          ([key]) => !exif[key as keyof typeof exif],
        ),
      ),
      // a title from the metadata, else the file name
      title:
        title || name.slice(0, name.lastIndexOf(".")).replace(/_/g, " ").trim(),
    };
  }

  /** Metadata of a new picture (created on demand). */
  function metaOf(photo: Photo): Meta {
    return (meta.value[photo.sha1!] ??= emptyMeta());
  }

  /**
   * Apply pasted rows: matched by the file column (path or file name), else
   * by order starting at `startRow`. Returns the number of updated pictures
   * and rows that matched none, and a function to undo.
   */
  function applyTable(table: Table, startRow = 0) {
    const before = JSON.stringify(meta.value);
    const photos = newPhotos.value;
    const byName = (file: string) =>
      photos.find((p) => p.path === file) ??
      photos.find((p) => p.path.split("/").pop() === file);
    let updated = 0;
    let unmatched = 0;
    table.rows.forEach((row, i) => {
      const photo = row.file ? byName(row.file) : photos[startRow + i];
      if (!photo) return unmatched++;
      Object.assign(metaOf(photo), row.values);
      updated++;
    });
    const undo = () => {
      meta.value = JSON.parse(before) as Record<string, Meta>;
    };
    return { updated, unmatched, undo };
  }

  /** normalized titles of selected files that exist on Commons */
  const existingTitles = ref(new Set<string>());
  const checkingTitles = ref(false);
  /** categories of selected files that do not exist on Commons */
  const unknownCategories = ref(new Set<string>());
  /** normalized titles protected against creation */
  const protectedTitles = ref(new Set<string>());
  /** title blacklist reasons by normalized title, cached per wiki */
  const blacklisted = ref(new Map<string, string>());
  const blacklistChecked = new Set<string>();
  async function checkTitles() {
    checkingTitles.value = true;
    try {
      const titles = items.value.map((item) => item.title);
      const [status, categories] = await Promise.all([
        fileStatus(titles, target.value),
        missingCategories(items.value.flatMap(categoriesOf)),
        pool(
          titles.filter(
            (t) => !blacklistChecked.has(`${target.value.id}:${t}`),
          ),
          4,
          async (title) => {
            const reason = await titleBlacklist(title, target.value);
            blacklistChecked.add(`${target.value.id}:${title}`);
            if (reason) blacklisted.value.set(title, reason);
            else blacklisted.value.delete(title);
          },
        ),
      ]);
      existingTitles.value = status.existing;
      protectedTitles.value = status.protected;
      unknownCategories.value = categories;
      blacklisted.value = new Map(blacklisted.value);
    } finally {
      checkingTitles.value = false;
    }
  }

  // names taken on one wiki may be free on another
  watch(target, () => {
    existingTitles.value = new Set();
    protectedTitles.value = new Set();
    blacklisted.value = new Map();
    if (items.value.length) checkTitles().catch(console.warn);
  });

  const { username } = useAuth();
  const categoriesOf = (item: { meta: Meta }) =>
    splitCategories(
      effectiveMeta(item.meta, defaults.value, username.value).categories,
    );
  const items = computed<Item[]>(() => {
    const selected = newPhotos.value.filter((photo) => !metaOf(photo).skip);
    const titleCount = new Map<string, number>();
    const all = selected.map((photo) => {
      const m = metaOf(photo);
      const title = normalizeTitle(fileTitle(m, photo.path));
      titleCount.set(title, (titleCount.get(title) ?? 0) + 1);
      return {
        photo,
        meta: m,
        title,
        text: pageText(m, defaults.value, username.value),
        problems: problems(m, photo.path, defaults.value, username.value),
        unknownCategories: [] as string[],
        details: {} as Partial<Record<Problem, string>>,
        invalid: false,
      };
    });
    for (const item of all) {
      if (titleCount.get(item.title)! > 1)
        item.problems.push("title-duplicate");
      if (existingTitles.value.has(item.title))
        item.problems.push("title-exists");
      if (item.photo.file.size > MAX_SIZE) item.problems.push("file-large");
      item.unknownCategories = categoriesOf(item).filter((c) =>
        unknownCategories.value.has(c),
      );
      if (item.unknownCategories.length) {
        item.problems.push("categories-unknown");
        item.details["categories-unknown"] = item.unknownCategories.join(", ");
      }
      if (protectedTitles.value.has(item.title))
        item.problems.push("title-protected");
      const reason = blacklisted.value.get(item.title);
      if (reason) {
        item.problems.push("title-blacklisted");
        item.details["title-blacklisted"] = reason;
      }
      item.invalid = item.problems.some((p) => ERRORS.has(p));
    }
    return all;
  });

  const counts = computed(() => {
    const result: Record<Status, number> = {
      queued: 0,
      hashing: 0,
      new: 0,
      exists: 0,
      duplicate: 0,
      error: 0,
    };
    for (const photo of photos.value) result[photo.status]++;
    return result;
  });

  /** pictures to describe and upload */
  const newPhotos = computed(() =>
    photos.value.filter((photo) => photo.status === "new"),
  );

  return {
    directory,
    photos,
    scanning,
    counts,
    newPhotos,
    meta,
    defaults,
    metaOf,
    applyTable,
    items,
    checkTitles,
    checkingTitles,
    open,
  };
});
