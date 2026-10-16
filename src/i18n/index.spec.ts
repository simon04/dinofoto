import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { isRTL, language, locale, t } from ".";

afterEach(() => {
  language.value = "en";
});

describe("locale", () => {
  it("canonicalizes Wikimedia language codes", () => {
    expect(locale("de")).toBe("de");
    expect(locale("zh-hans")).toBe("zh-Hans");
  });

  it("falls back to English for invalid codes", () => {
    expect(locale("not a language")).toBe("en");
  });
});

describe("isRTL", () => {
  it.each([
    ["ar", true],
    ["he", true],
    ["ks-arab", true],
    ["en", false],
    ["de", false],
  ])("%s → %s", (code, rtl) => {
    expect(isRTL(code)).toBe(rtl);
  });
});

describe("t", () => {
  it("replaces parameters", () => {
    expect(t("files-checking", 3, 10)).toBe("Checking 3 / 10");
  });

  it("picks English plural forms", () => {
    expect(t("files-found", 1)).toBe("1 picture");
    expect(t("files-found", 2)).toBe("2 pictures");
    expect(t("files-found", 0)).toBe("0 pictures");
  });
});

describe("translations", () => {
  it("loads translations on demand, with base-language fallback", async () => {
    language.value = "de-at";
    await vi.waitFor(() => expect(t("step-files")).not.toBe("1. Files"));
    language.value = "nl";
    await vi.waitFor(() => expect(t("step-files")).toBe("1. Files"));
  });
});
