import { t, type MessageKey } from "./i18n";
import { apiUrl, type Wiki } from "./wiki";

export interface Auth {
  accessToken: string;
  username: string;
  /** the wiki to edit */
  wiki: Wiki;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    info: string,
  ) {
    super(info);
    this.name = "ApiError";
  }
}

/**
 * Authenticated POST to the Action API with an OAuth 2.0 access
 * token. `crossorigin` (instead of `origin=*`) keeps the request
 * authenticated; `assertuser` fails instead of uploading anonymously.
 */
export async function apiPost<T>(
  params: Record<string, string | Blob>,
  auth: Auth,
): Promise<T> {
  const url = new URL(apiUrl(auth.wiki));
  url.search = new URLSearchParams({ crossorigin: "" }).toString();
  const body = new FormData();
  const all: Record<string, string | Blob> = {
    format: "json",
    formatversion: "2",
    errorformat: "plaintext",
    assertuser: auth.username,
    ...params,
  };
  // the file last, as recommended for multipart uploads
  for (const [key, value] of Object.entries(all))
    if (!(value instanceof Blob)) body.append(key, value);
  for (const [key, value] of Object.entries(all))
    if (value instanceof Blob) body.append(key, value);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    body,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  const error = json.errors?.[0] as { code: string; text: string } | undefined;
  if (error) throw new ApiError(error.code, error.text);
  return json as T;
}

/** CSRF token for edits by the authenticated user. */
export async function getCsrfToken(auth: Auth): Promise<string> {
  const json = await apiPost<{ query: { tokens: { csrftoken: string } } }>(
    { action: "query", meta: "tokens", type: "csrf" },
    auth,
  );
  return json.query.tokens.csrftoken;
}

export type UploadResult =
  | { result: "Success"; filename: string; filekey?: string }
  /** not uploaded, e.g. `exists` or `duplicate`; stashed as `filekey` */
  | { result: "Warning"; warnings: Record<string, unknown>; filekey?: string };

/**
 * Upload a file (`action=upload`), or publish a stashed one (`filekey`).
 * Warnings stop the upload unless `ignorewarnings`.
 */
export async function upload(
  {
    file,
    filekey,
    filename,
    text,
    comment,
    ignorewarnings = false,
  }: {
    file?: File;
    filekey?: string;
    filename: string;
    text: string;
    comment: string;
    ignorewarnings?: boolean;
  },
  token: string,
  auth: Auth,
): Promise<UploadResult> {
  const json = await apiPost<{ upload: UploadResult }>(
    {
      action: "upload",
      filename,
      text,
      comment,
      token,
      ...(ignorewarnings ? { ignorewarnings: "1" } : {}),
      ...(filekey ? { filekey } : { file: file! }),
    },
    auth,
  );
  return json.upload;
}

/** Chunk size of chunked uploads, as in UploadWizard. */
export const CHUNK_SIZE = 5 * 1024 * 1024;
/** Larger files are uploaded in chunks and assembled asynchronously. */
export const CHUNKED_FROM = 2 * CHUNK_SIZE;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry a request on network errors (not on API errors). */
async function retry<T>(request: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (e) {
      if (e instanceof ApiError || attempt >= attempts) throw e;
      await sleep(2000 * attempt);
    }
  }
}

type Polled = UploadResult | { result: "Poll" | "Continue"; filekey: string };

/** Wait for an asynchronous upload step (`async=1`) to finish. */
async function poll(
  filekey: string,
  token: string,
  auth: Auth,
): Promise<UploadResult> {
  // assembling or publishing gigabytes may take minutes
  for (let i = 0; i < 600; i++) {
    await sleep(Math.min(1000 + i * 500, 5000));
    const json = await retry(() =>
      apiPost<{ upload: Polled & { stage?: string } }>(
        { action: "upload", checkstatus: "1", filekey, token },
        auth,
      ),
    );
    if (json.upload.result !== "Poll") return json.upload as UploadResult;
  }
  throw new Error("Timeout");
}

/**
 * Upload a large file in chunks to the stash (`stash=1`), like UploadWizard;
 * each chunk is retried on network errors. Returns the `filekey`.
 */
export async function stashChunked(
  file: File,
  filename: string,
  token: string,
  auth: Auth,
  onProgress?: (bytes: number) => void,
): Promise<string> {
  let filekey: string | undefined;
  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const last = offset + chunk.size >= file.size;
    const json = await retry(() =>
      apiPost<{ upload: Polled & { offset?: number } }>(
        {
          action: "upload",
          stash: "1",
          // warnings are checked when publishing
          ignorewarnings: "1",
          filename,
          filesize: String(file.size),
          offset: String(offset),
          chunk: new File([chunk], filename),
          token,
          ...(filekey ? { filekey } : {}),
          ...(last ? { async: "1" } : {}),
        },
        auth,
      ),
    );
    const result = json.upload;
    if ("filekey" in result && result.filekey) filekey = result.filekey;
    offset = last ? file.size : (result.offset ?? offset + chunk.size);
    onProgress?.(offset);
    if (last && result.result === "Poll") {
      const done = await poll(filekey!, token, auth);
      if (done.result !== "Success") throw new Error(JSON.stringify(done));
    }
  }
  return filekey!;
}

/**
 * Upload a file: small ones directly, large ones in chunks to the stash and
 * then published asynchronously. Warnings stop the upload unless
 * `ignorewarnings`; the file is stashed then (`filekey`).
 */
export async function uploadFile(
  {
    file,
    filekey,
    filename,
    text,
    comment,
    ignorewarnings = false,
  }: {
    file: File;
    filekey?: string;
    filename: string;
    text: string;
    comment: string;
    ignorewarnings?: boolean;
  },
  token: string,
  auth: Auth,
  onProgress?: (bytes: number) => void,
): Promise<UploadResult> {
  if (!filekey && file.size < CHUNKED_FROM)
    return upload(
      { file, filename, text, comment, ignorewarnings },
      token,
      auth,
    );
  filekey ??= await stashChunked(file, filename, token, auth, onProgress);
  const json = await apiPost<{ upload: Polled }>(
    {
      action: "upload",
      filekey,
      filename,
      text,
      comment,
      token,
      async: "1",
      ...(ignorewarnings ? { ignorewarnings: "1" } : {}),
    },
    auth,
  );
  const result =
    json.upload.result === "Poll"
      ? await poll(filekey, token, auth)
      : (json.upload as UploadResult);
  // warnings of a stashed file: publish it later with this key
  return result.result === "Warning" ? { filekey, ...result } : result;
}

/**
 * Stash a file without publishing it, e.g. to learn about duplicates first.
 * Warnings of small files are returned; those of chunked uploads only show
 * when publishing.
 */
export async function stashFile(
  file: File,
  filename: string,
  token: string,
  auth: Auth,
  onProgress?: (bytes: number) => void,
): Promise<{ filekey: string; warnings?: Record<string, unknown> }> {
  if (file.size >= CHUNKED_FROM)
    return {
      filekey: await stashChunked(file, filename, token, auth, onProgress),
    };
  const json = await apiPost<{
    upload: { filekey: string; warnings?: Record<string, unknown> };
  }>({ action: "upload", stash: "1", filename, file, token }, auth);
  return json.upload;
}

/** Human-readable warnings of an upload. */
export function formatWarnings(warnings: Record<string, unknown>): string {
  return Object.entries(warnings)
    .map(([key, value]) => {
      const text = [value].flat().join(", ");
      const message = WARNINGS[key];
      return message ? t(message, text) : text ? `${key}: ${text}` : key;
    })
    .join(" ");
}

const WARNINGS: Record<string, MessageKey> = {
  exists: "warning-exists",
  "exists-normalized": "warning-exists",
  "page-exists": "warning-exists",
  duplicate: "warning-duplicate",
  "duplicate-archive": "warning-duplicate-archive",
  duplicateversions: "warning-duplicate",
  "was-deleted": "warning-was-deleted",
  badfilename: "warning-badfilename",
  "bad-prefix": "warning-bad-prefix",
  "empty-file": "warning-empty-file",
};
