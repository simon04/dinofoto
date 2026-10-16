import { createGlobalState, useLocalStorage } from "@vueuse/core";
import { computed, ref, shallowRef } from "vue";
import { findBySha1 } from "./commons";
import { readExif } from "./exif";
import { language } from "./i18n";
import { emptyMeta, initialDefaults, type Defaults, type Meta } from "./meta";
import { pool } from "./pool";
import { fileKey, scanDirectory, sha1 } from "./scan";

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

export const usePhotos = createGlobalState(() => {
  const directory = shallowRef<FileSystemDirectoryHandle>();
  const photos = ref<Photo[]>([]);
  const scanning = ref(false);
  /** SHA-1 by path, size and modification time, to skip re-hashing */
  const hashes = useLocalStorage<Record<string, string>>("dinofoto.sha1", {});
  /** metadata by SHA-1, kept across reloads and directories */
  const meta = useLocalStorage<Record<string, Meta>>("dinofoto.meta", {});
  const defaults = useLocalStorage<Defaults>(
    "dinofoto.defaults",
    initialDefaults(language.value),
    { mergeDefaults: true },
  );
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
    meta.value[sha1] = {
      ...emptyMeta(),
      title: name.slice(0, name.lastIndexOf(".")).replace(/_/g, " ").trim(),
      ...(await readExif(photo.file)),
    };
  }

  /** Metadata of a new picture (created on demand). */
  function metaOf(photo: Photo): Meta {
    return (meta.value[photo.sha1!] ??= emptyMeta());
  }

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
    open,
  };
});
