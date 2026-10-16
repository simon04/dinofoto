import { describe, expect, it } from "vite-plus/test";
import { prefillFromUrl } from "./prefill";

describe("prefillFromUrl", () => {
  it("reads UploadWizard-style parameters", () => {
    expect(
      prefillFromUrl(
        "?categories=WLM 2026|Kraków&description=Monument&lat=50.06&lon=19.93&caption=Hall&captionlang=en&campaign=x",
      ),
    ).toEqual({
      defaults: { categories: "WLM 2026; Kraków", description: "Monument" },
      meta: { latitude: "50.06", longitude: "19.93", caption: "en: Hall" },
    });
  });
});
