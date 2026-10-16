/** File types accepted by Commons that count as pictures. */
export const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "tif",
  "tiff",
  "webp",
  "svg",
];

export function extension(name: string): string {
  return name.slice(name.lastIndexOf(".") + 1).toLowerCase();
}

export function isImage(name: string): boolean {
  return (
    name.includes(".") &&
    !name.startsWith(".") &&
    IMAGE_EXTENSIONS.includes(extension(name))
  );
}

export interface ScannedFile {
  /** path relative to the opened directory, with `/` */
  path: string;
  file: File;
}

/** All pictures in a directory and its subdirectories, in natural order. */
export async function scanDirectory(
  dir: FileSystemDirectoryHandle,
  prefix = "",
): Promise<ScannedFile[]> {
  const result: ScannedFile[] = [];
  for await (const entry of dir.values()) {
    // hidden files and directories, e.g. .thumbnails
    if (entry.name.startsWith(".")) continue;
    if (entry.kind === "directory")
      result.push(...(await scanDirectory(entry, `${prefix}${entry.name}/`)));
    else if (isImage(entry.name))
      result.push({ path: prefix + entry.name, file: await entry.getFile() });
  }
  return result.sort((a, b) => collator.compare(a.path, b.path));
}

const collator = new Intl.Collator(undefined, { numeric: true });

/** SHA-1 of a file as lowercase hex, as used by Commons (`aisha1`). */
export async function sha1(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cache key for a file's hash: changes when the file is modified. */
export const fileKey = (path: string, file: File) =>
  `${path}|${file.size}|${file.lastModified}`;
