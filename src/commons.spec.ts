import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { fileStatus, titleBlacklist } from "./commons";

const respond = (json: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(json))),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("titleBlacklist", () => {
  it("returns the reason as text", async () => {
    respond({
      titleblacklist: {
        result: "blacklisted",
        reason: "<p>Please use a <b>descriptive</b> name.</p>",
        message: "titleblacklist-custom-filename",
      },
    });
    expect(await titleBlacklist("DSC 1.JPG")).toBe(
      "Please use a descriptive name.",
    );
  });

  it("returns nothing for allowed names", async () => {
    respond({ titleblacklist: { result: "ok" } });
    expect(await titleBlacklist("Kraków.jpg")).toBeUndefined();
  });
});

describe("fileStatus", () => {
  it("finds existing and create-protected files", async () => {
    respond({
      query: {
        pages: [
          { title: "File:A.jpg", pageid: 1, protection: [] },
          {
            title: "File:B.jpg",
            missing: true,
            protection: [{ type: "create", level: "sysop" }],
          },
          { title: "File:C.jpg", missing: true, protection: [] },
        ],
      },
    });
    const status = await fileStatus(["A.jpg", "B.jpg", "C.jpg"]);
    expect([...status.existing]).toEqual(["A.jpg"]);
    expect([...status.protected]).toEqual(["B.jpg"]);
  });
});
