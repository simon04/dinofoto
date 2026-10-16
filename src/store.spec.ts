import { beforeEach, describe, expect, it } from "vite-plus/test";
import { readTable } from "./csv";
import { usePhotos, type Photo } from "./store";

const photo = (path: string, sha1: string): Photo => ({
  path,
  file: new File(["x"], path.split("/").pop()!),
  sha1,
  status: "new",
});

describe("usePhotos", () => {
  const store = usePhotos();

  beforeEach(() => {
    store.meta.value = {};
    store.photos.value = [
      photo("a/IMG_1.jpg", "s1"),
      photo("a/IMG_2.jpg", "s2"),
      photo("b/IMG_3.jpg", "s3"),
    ];
  });

  it("applies pasted rows by file name, path or order", () => {
    const { updated, unmatched } = store.applyTable(
      readTable("file,title\nIMG_2.jpg,Two\nb/IMG_3.jpg,Three\nnope.jpg,X"),
    );
    expect([updated, unmatched]).toEqual([2, 1]);
    expect(store.photos.value.map((p) => store.metaOf(p).title)).toEqual([
      "",
      "Two",
      "Three",
    ]);
    store.applyTable(readTable("A\nB", "description"), 1);
    expect(store.metaOf(store.photos.value[2]!).description).toBe("B");
  });

  it("undoes a paste", () => {
    const { undo } = store.applyTable(readTable("title\nOne"));
    expect(store.metaOf(store.photos.value[0]!).title).toBe("One");
    undo();
    expect(store.metaOf(store.photos.value[0]!).title).toBe("");
  });

  it("flags duplicate titles and skips deselected files", () => {
    for (const p of store.photos.value)
      Object.assign(store.metaOf(p), { title: "Same name here" });
    expect(
      store.items.value.every((i) => i.problems.includes("title-duplicate")),
    ).toBe(true);
    store.metaOf(store.photos.value[0]!).skip = true;
    expect(store.items.value).toHaveLength(2);
  });
});
