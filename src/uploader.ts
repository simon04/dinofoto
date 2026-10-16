import { createGlobalState, useLocalStorage } from "@vueuse/core";
import { computed, reactive, ref } from "vue";
import { useAuth } from "./auth";
import { t } from "./i18n";
import { mediaInfoId, saveStructuredData, structuredData } from "./sdc";
import { target } from "./wiki";
import { usePhotos, type Item } from "./store";
import {
  ApiError,
  formatWarnings,
  getCsrfToken,
  stashFile,
  uploadFile,
  type Auth,
} from "./upload";

export interface UploadState {
  state:
    | "waiting"
    | "checking"
    /** stashed without warnings, ready to publish */
    | "checked"
    | "uploading"
    | "done"
    | "warning"
    | "failed";
  message?: string;
  /** stashed file of an upload stopped by warnings */
  filekey?: string;
  /** bytes uploaded of a chunked upload */
  bytes?: number;
  /** MediaInfo ID of the uploaded file, once known */
  mid?: string;
  /** title of the uploaded file, without `File:` */
  filename?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries for network errors and rate limits, so a batch runs unattended. */
const RETRIES = 5;

export const useUploader = createGlobalState(() => {
  const { items, defaults } = usePhotos();
  const { accessToken, username } = useAuth();
  const comment = useLocalStorage("dinofoto.comment", "Uploaded with DinoFoto");
  /** by picture path */
  const states = reactive<Record<string, UploadState>>({});
  const running = ref(false);
  /** a batch or a single file is being uploaded */
  const busy = computed(
    () =>
      running.value ||
      Object.values(states).some((s) => s.state === "uploading"),
  );
  const pausing = ref(false);

  /** uploads are tracked per target: a test upload is no Commons upload */
  const keyOf = (item: Item) => `${target.value.id}:${item.photo.path}`;
  const stateOf = (item: Item): UploadState =>
    states[keyOf(item)] ?? { state: "waiting" };
  // uploaded files stay, though their names are taken now
  const queue = computed(() =>
    items.value.filter(
      (item) => !item.invalid || stateOf(item).state === "done",
    ),
  );

  function auth(): Auth {
    if (!accessToken.value || !username.value)
      throw new ApiError("notloggedin", "Not logged in");
    return {
      accessToken: accessToken.value,
      username: username.value,
      wiki: target.value,
    };
  }

  async function uploadItem(item: Item, ignorewarnings = false) {
    const key = keyOf(item);
    states[key] = {
      ...stateOf(item),
      state: "uploading",
      message: undefined,
      bytes: 0,
    };
    // the reactive proxy, not the object assigned above
    const state = states[key]!;
    for (let attempt = 1; ; attempt++) {
      try {
        // fetched per file: tokens of renewed sessions differ
        const token = await getCsrfToken(auth());
        const result = await uploadFile(
          {
            file: item.photo.file,
            filekey: state.filekey,
            filename: item.title,
            text: item.text,
            comment: comment.value,
            ignorewarnings,
          },
          token,
          auth(),
          (bytes) => (state.bytes = bytes),
        );
        if (result.result === "Success") {
          Object.assign(state, {
            state: "done",
            filekey: undefined,
            filename: result.filename,
          });
          await saveSdc(item, result.filename, token, state);
        } else {
          Object.assign(state, {
            state: "warning",
            message: formatWarnings(result.warnings),
            filekey: result.filekey,
          });
        }
        return;
      } catch (e) {
        const code = e instanceof ApiError ? e.code : "";
        // stashed files expire after some hours: upload again
        if (state.filekey && /stash|filekey/.test(code)) {
          state.filekey = undefined;
          continue;
        }
        const retry =
          attempt < RETRIES &&
          (!code || code === "ratelimited" || code === "badtoken");
        if (!retry) {
          Object.assign(state, {
            state: "failed",
            message: e instanceof Error ? e.message : String(e),
          });
          return;
        }
        // back off: 5 s, 10 s, 20 s, … and a minute for rate limits
        await sleep(code === "ratelimited" ? 60_000 : 5_000 * 2 ** attempt);
      }
    }
  }

  /** Captions and depicts; a failure is reported, the upload stays done. */
  async function saveSdc(
    item: Item,
    filename: string,
    token: string,
    state: UploadState,
  ) {
    const data = structuredData(
      item.meta,
      defaults.value,
      target.value,
      username.value,
    );
    if (!data) return;
    try {
      state.mid = await mediaInfoId(filename, auth());
      await saveStructuredData(
        state.mid,
        data,
        { token, summary: comment.value },
        auth(),
      );
    } catch (e) {
      state.message = t(
        "upload-sdc-failed",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  /**
   * Stash all files not uploaded yet without publishing them, to show
   * warnings such as duplicates or deleted files before anything is public.
   */
  async function check() {
    if (running.value) return;
    running.value = true;
    pausing.value = false;
    try {
      for (const item of queue.value) {
        if (pausing.value) break;
        if (!["waiting", "failed"].includes(stateOf(item).state)) continue;
        await checkItem(item);
      }
    } finally {
      running.value = false;
      pausing.value = false;
    }
  }

  async function checkItem(item: Item) {
    const key = keyOf(item);
    states[key] = { state: "checking", bytes: 0 };
    const state = states[key]!;
    try {
      const token = await getCsrfToken(auth());
      const { filekey, warnings } = await stashFile(
        item.photo.file,
        item.title,
        token,
        auth(),
        (bytes) => (state.bytes = bytes),
      );
      const relevant = Object.keys(warnings ?? {}).length > 0;
      Object.assign(state, {
        state: relevant ? "warning" : "checked",
        filekey,
        message: relevant ? formatWarnings(warnings!) : undefined,
      });
    } catch (e) {
      Object.assign(state, {
        state: "failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /** Upload all files not uploaded yet, one after another. */
  async function start() {
    if (running.value) return;
    running.value = true;
    pausing.value = false;
    try {
      for (const item of queue.value) {
        if (pausing.value) break;
        if (["done", "warning"].includes(stateOf(item).state)) continue;
        await uploadItem(item);
      }
    } finally {
      running.value = false;
      pausing.value = false;
    }
  }

  /** Stop after the current file. */
  function pause() {
    pausing.value = true;
  }

  const summary = computed(() => {
    const result = { done: 0, failed: 0, warning: 0, bytes: 0, total: 0 };
    for (const item of queue.value) {
      const { state, bytes } = stateOf(item);
      result.total += item.photo.file.size;
      if (state === "uploading" || state === "checking")
        result.bytes += bytes ?? 0;
      if (state === "done") {
        result.done++;
        result.bytes += item.photo.file.size;
      } else if (state === "failed") result.failed++;
      else if (state === "warning") result.warning++;
    }
    return result;
  });

  return {
    comment,
    queue,
    stateOf,
    running,
    busy,
    pausing,
    summary,
    start,
    check,
    pause,
    uploadItem,
  };
});
