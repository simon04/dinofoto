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
  | { result: "Success"; filename: string }
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

/** Human-readable warnings of a failed upload. */
export function formatWarnings(warnings: Record<string, unknown>): string {
  return Object.entries(warnings)
    .map(([key, value]) =>
      typeof value === "string" || Array.isArray(value)
        ? `${key}: ${[value].flat().join(", ")}`
        : key,
    )
    .join("; ");
}
