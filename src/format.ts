import { locale } from "./i18n";

/** File size in MB (or kB below 1 MB), in the selected language. */
export function formatSize(bytes: number): string {
  const mb = bytes / 1e6;
  return mb >= 1
    ? `${mb.toLocaleString(locale(), { maximumFractionDigits: 1 })} MB`
    : `${Math.ceil(bytes / 1e3).toLocaleString(locale())} kB`;
}
