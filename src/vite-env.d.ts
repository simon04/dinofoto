/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth 2.0 consumer key (public client) */
  readonly VITE_OAUTH_CLIENT_ID: string;
  /** callback URL registered with the consumer, exactly matched */
  readonly VITE_OAUTH_REDIRECT_URI: string;
}

/** File System Access API (Chromium), not yet in lib.dom.d.ts */
interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: string | FileSystemHandle;
  }): Promise<FileSystemDirectoryHandle>;
}
