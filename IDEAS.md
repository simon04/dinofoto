# Ideas

Feature ideas for DinoFoto, collected from the role models [Pattypan](https://commons.wikimedia.org/wiki/Commons:Pattypan) and [VicuñaUploader](https://commons.wikimedia.org/wiki/Commons:Vicu%C3%B1aUploader), the [structured data GLAM tools](https://commons.wikimedia.org/wiki/Commons:Structured_data/GLAM/Tools) (OpenRefine, QuickStatements, Minefield, AC/DC, Cat2Data, ISA, Depictor, WikiCrowd, WCQS) and [UploadWizard](https://www.mediawiki.org/wiki/Extension:UploadWizard).

Also from a community wishlist (workshop, “What bothers you technically on Commons?”); votes as (●n).

Effort: **S** small (hours), **M** medium (a day or two), **L** large.

## From the community wishlist

- **Edit existing files** (M/L, ●7 “table view with date, categories … without opening each file”): load a category or your uploads into the same table, edit categories, captions and statements, save in one go.
- **Sort categories by date taken** (S, ●4): option to add a date sort key (`{{DEFAULTSORT:2024-05-01 12:00}}` or per category), so category pages list photos chronologically.
- **Geotag from GPX** (M, ●1 “import gpx, kml”): match capture times to a GPX track (with camera clock offset); export the batch as KML/GPX.
- **Extra templates** (S, ●1 “personality rights every time”): a column and default for additional templates, e.g. `{{Personality rights}}`, kept in presets.
- **Create missing categories** (M, ●3 “find and create categories automatically”): with a parent category and optionally a Wikidata infobox.
- **Pages from templates** (M, ●5 “standardized pages from templates, e.g. galleries”): create a gallery or category page for the batch.
- **Image-error warnings** (M, ●1, ●2 “mini image editing”): low resolution, blur, near-duplicates in the review; rotate and crop before upload.
- **AI suggestions** (L, ●1): depicts and captions suggested by image recognition, to be confirmed; photos would leave the browser.
- **Video** (L, ●2 “no MP4 upload”, ●4 “video editing”): convert MP4 to WebM in the browser (WebCodecs/ffmpeg.wasm), optionally trimmed; needs chunked upload.
- **One tool for everything** (M, ●2): UploadWizard campaigns and URL prefill (below), so DinoFoto replaces more tools.

Out of scope (Commons itself): search (●3), map search, MediaViewer speed (●2), video player, decluttered UI (●4), category pages and sorting by quality, links from wikis to Commons (●3), embedding in wikis (●2), crop tool, RAW converter, replacing categories by structured data (●5, a community decision; DinoFoto derives both from one input).

## Uploading

- **Parallel uploads** (S, UploadWizard): up to 3 at once instead of strictly one after another.
- **Per-file progress bar** (S): `XMLHttpRequest` upload progress for large files.
- **Captcha and AbuseFilter handling** (S/M, UploadWizard): show the captcha or filter warning and continue instead of failing the file.
- **Change tag** (S, UploadWizard): register a `dinofoto` change tag and set it on uploads and structured data edits.
- **Batch-size guard** (S, UploadWizard): read `meta=userinfo&uiprop=rights`; note the `mass-upload` right or rate limits before starting 500 files.
- **Reopen the last directory after a reload** (M): keep the `FileSystemDirectoryHandle` in IndexedDB, re-request permission; with the saved metadata, an interrupted batch continues where it stopped.
- **Large directories (1000+ photos)** (M): virtual scrolling for the table, hashing in a Web Worker.
- **Firefox/Safari** (S): fall back to `<input webkitdirectory>` (read-only).

## Checks

- **No categories** (S, UploadWizard): add `{{Uncategorized}}`-style wikitext or ask for confirmation.
- **Minimum lengths** (S, UploadWizard): captions and descriptions of at least 5 characters.

## Rights and licensing

- **Release-rights wizard** (M, UploadWizard): own work vs. someone else’s work; “contains others’ work” and “for personal use” questions that block the upload; public domain (PD-old-70, PD-US, PD-USGov, NASA, …), heirs, VRT permission and custom license wikitext, validated to contain a license template.
- **AI-generated media** (S, UploadWizard): `{{PD-algorithm}}` with tool and prompt.
- **License per file from a list** (S): license column with the presets as suggestions.
- **Source URL → source of file** (S, UploadWizard): map known sites to items for P7482 with P137/P973.

## Describing

- **Map picker** (M): set or correct the location of photos without GPS on an OpenStreetMap map.
- **Larger preview while typing** (S): the photo of the focused row next to the table.
- **GPS privacy** (M, UploadWizard only warns): remove GPS from the EXIF before uploading, per file or batch, or leave out the location.
- **More EXIF** (S): camera model, focal length, orientation-aware thumbnails.
- **Template choice** (S): `{{Photograph}}` or `{{Artwork}}` instead of `{{Information}}`; an “other information” wikitext column.
- **Multilingual descriptions** (M, UploadWizard): one column per language instead of language templates.
- **Category suggestions from history** (S, UploadWizard): recently used categories first.
- **Unit tests for the store** (S): `applyTable`, title checks, presets.
- **Downloadable CSV template** (S) and the CSV format in the README.

## Structured data

- **Depicts from categories** (M, Cat2Data, AC/DC): the Wikidata item of a category (via its infobox or P373) as depicts suggestion.
- **Depicts from location** (M, WCQS; ●2 “category/SD suggestions via coordinates”): Wikidata items near the photo (`wikibase:around`) as suggestions.
- **Wikidata reconciliation for pasted text** (M, OpenRefine): match pasted names to items, confirm candidates.
- **Quick yes/no for suggested depicts** (M, WikiCrowd, Depictor): card view with thumbnail and suggestion.
- **Enrich files already on Commons** (M, ISA, SDC tool): for photos skipped as duplicates, show and add missing captions and statements.
- **Default statements in presets** (S, OpenRefine schemas): e.g. creator as own Wikidata item, or a fixed depicts.
- **Batch verification links** (S, Media Search, WCQS; ●3 “evaluate structured data”, ●2 “list of all files with statement XYZ”): `haswbstatement:`/`incategory:` search and a WCQS map of the batch.
- **Show labels of depicted items** (S): fetch labels for the Q-IDs in the table and review.

## Campaigns

- **UploadWizard campaigns** (M/L): load `Campaign:X` JSON (`?campaign=X`): defaults, `autoAdd` categories and wikitext, custom fields, restricted licenses, start/end, tracking category.
- **URL parameters** (S, UploadWizard): prefill defaults (`categories`, `description`, `caption`, `lat`, `lon`, …) from the URL, e.g. for Wiki Loves Monuments lists.

## Done

Object location. Titles, descriptions and keyword categories from EXIF/IPTC/XMP. Title blacklist, protected titles and UploadWizard’s title rules. Chunked and asynchronous upload, stashing first to show server warnings (incl. deleted duplicates). Test mode (Test Commons, Test Wikipedia), file name patterns, category suggestions (search and nearby) and nonexistent-category warnings, captions in several languages, depicts, structured data derived from the table (inception, point of view and heading, license, copyright status, own work and creator), edit selected rows, presets, MediaInfo IDs, gallery and QuickStatements export after uploading.
