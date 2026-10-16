import { shallowRef, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import en from "./en.json";

export type MessageKey = keyof typeof en;
type Messages = Partial<Record<MessageKey, string>>;

/** User-selected language (Wikimedia language code). */
export const language = useLocalStorage(
  "dinofoto.language",
  navigator.language.split("-")[0].toLowerCase() || "en",
);

/** Wikimedia language code → BCP 47 locale supported by Intl, else "en". */
export function locale(code = language.value): string {
  try {
    return Intl.getCanonicalLocales(code)[0] ?? "en";
  } catch {
    return "en";
  }
}

// translations other than English are loaded on demand
const loaders = import.meta.glob<{ default: Messages }>([
  "./*.json",
  "!./en.json",
]);
const messages = shallowRef<Messages>({});
watch(
  language,
  async (code) => {
    // e.g. zh-hans → zh
    const load =
      loaders[`./${code}.json`] ?? loaders[`./${code.split("-")[0]}.json`];
    messages.value = load ? (await load()).default : {};
  },
  { immediate: true },
);

const RTL = new Set([
  "ar",
  "arc",
  "arz",
  "azb",
  "ckb",
  "dv",
  "fa",
  "glk",
  "he",
  "ks",
  "lrc",
  "mzn",
  "pnb",
  "ps",
  "sd",
  "ug",
  "ur",
  "yi",
]);
export const isRTL = (code = language.value) =>
  RTL.has(code.split("-")[0]) || code.endsWith("-arab");

const CATEGORIES = ["zero", "one", "two", "few", "many", "other"];

/** Pick a {{PLURAL}} form: forms are given in CLDR category order. */
function plural(n: number, forms: string[]): string {
  const rules = new Intl.PluralRules(locale());
  const categories = CATEGORIES.filter((c) =>
    rules.resolvedOptions().pluralCategories.includes(c as Intl.LDMLPluralRule),
  );
  // explicit zero form only if the language has one (e.g. Arabic)
  const index = categories.indexOf(rules.select(n));
  return forms[Math.min(index, forms.length - 1)] ?? "";
}

/**
 * Translate a message. Supports MediaWiki-style `$1` parameters and
 * `{{PLURAL:$1|one|other}}`.
 */
export function t(key: MessageKey, ...params: (string | number)[]): string {
  const message = messages.value[key] ?? en[key];
  return message
    .replace(
      /\{\{PLURAL:\$(\d+)\|([^}]*)\}\}/g,
      (_, i: string, forms: string) =>
        plural(Number(params[+i - 1]), forms.split("|")),
    )
    .replace(/\$(\d+)/g, (_, i: string) => String(params[+i - 1] ?? ""));
}
