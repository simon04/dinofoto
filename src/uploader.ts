import { createGlobalState, useLocalStorage } from "@vueuse/core";
import { computed, reactive, ref } from "vue";
import { useAuth } from "./auth";
import { usePhotos, type Item } from "./store";
import {
  ApiError,
  formatWarnings,
  getCsrfToken,
  upload,
  type Auth,
} from "./upload";

export interface UploadState {
  state: "waiting" | "uploading" | "done" | "warning" | "failed";
  message?: string;
  /** stashed file of an upload stopped by warnings */
  filekey?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries for network errors and rate limits, so a batch runs unattended. */
const RETRIES = 5;

export const useUploader = createGlobalState(() => {
  const { items } = usePhotos();
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

  const stateOf = (item: Item): UploadState =>
    states[item.photo.path] ?? { state: "waiting" };
  // uploaded files stay, though their names are taken now
  const queue = computed(() =>
    items.value.filter(
      (item) => !item.invalid || stateOf(item).state === "done",
    ),
  );

  function auth(): Auth {
    if (!accessToken.value || !username.value)
      throw new ApiError("notloggedin", "Not logged in");
    return { accessToken: accessToken.value, username: username.value };
  }

  async function uploadItem(item: Item, ignorewarnings = false) {
    states[item.photo.path] = {
      ...stateOf(item),
      state: "uploading",
      message: undefined,
    };
    // the reactive proxy, not the object assigned above
    const state = states[item.photo.path]!;
    for (let attempt = 1; ; attempt++) {
      try {
        // fetched per file: tokens of renewed sessions differ
        const token = await getCsrfToken(auth());
        const result = await upload(
          {
            file: item.photo.file,
            filekey: ignorewarnings ? state.filekey : undefined,
            filename: item.title,
            text: item.text,
            comment: comment.value,
            ignorewarnings,
          },
          token,
          auth(),
        );
        if (result.result === "Success") {
          Object.assign(state, { state: "done", filekey: undefined });
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
      const { state } = stateOf(item);
      result.total += item.photo.file.size;
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
    pause,
    uploadItem,
  };
});
