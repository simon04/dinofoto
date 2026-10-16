# Ideas

Feature ideas for DinoFoto, collected from the role models [Pattypan](https://commons.wikimedia.org/wiki/Commons:Pattypan) and [VicuñaUploader](https://commons.wikimedia.org/wiki/Commons:Vicu%C3%B1aUploader), the [structured data GLAM tools](https://commons.wikimedia.org/wiki/Commons:Structured_data/GLAM/Tools) (OpenRefine, QuickStatements, Minefield, AC/DC, Cat2Data, ISA, Depictor, WikiCrowd, WCQS) and [UploadWizard](https://www.mediawiki.org/wiki/Extension:UploadWizard).

Effort: **S** small (hours), **M** medium (a day or two), **L** large.

## Uploading

- **Chunked and asynchronous upload** (M, UploadWizard): stash files over 100 MiB in ~5 MiB chunks (`action=upload&stash=1&offset=…&filekey=…`), publish with `async=1` above 10 MiB and poll `checkstatus`; retry single failed chunks.
- **Stash first, publish later** (M, UploadWizard): stash every file first to get the server’s warnings early (`duplicate`, `duplicate-archive` for deleted files, `duplicateversions`), then publish with `filekey`; lets the review show them before anything is published.
- **Parallel uploads** (S, UploadWizard): up to 3 at once instead of strictly one after another.
- **Per-file progress bar** (S): `XMLHttpRequest` upload progress for large files.
- **Captcha and AbuseFilter handling** (S/M, UploadWizard): show the captcha or filter warning and continue instead of failing the file.
- **Change tag** (S, UploadWizard): register a `dinofoto` change tag and set it on uploads and structured data edits.
- **Batch-size guard** (S, UploadWizard): read `meta=userinfo&uiprop=rights`; note the `mass-upload` right or rate limits before starting 500 files.
- **Reopen the last directory after a reload** (M): keep the `FileSystemDirectoryHandle` in IndexedDB, re-request permission; with the saved metadata, an interrupted batch continues where it stopped.
- **Large directories (1000+ photos)** (M): virtual scrolling for the table, hashing in a Web Worker.
- **Firefox/Safari** (S): fall back to `<input webkitdirectory>` (read-only).

## Checks

- **Title blacklist** (S, UploadWizard): `action=titleblacklist&tbaction=upload&tbtitle=File:…` per name in the review.
- **More title rules** (S, UploadWizard `QuickTitleChecker`): BiDi and control characters, soft hyphens, private-use characters, `''`, `123px-` prefixes, duplicated extensions, 5–235 bytes; more camera prefixes (PANA, …).
- **Protected titles** (S, UploadWizard): `inprop=protection` in the existence check.
- **Previously deleted files** (M): by hash via the stash warning `duplicate-archive` (`list=filearchive` needs the `deletedhistory` right).
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
- **Object location** (S, UploadWizard): `{{Object location}}` from `GPSDest*` EXIF; heading from `GPSDestBearing` as fallback.
- **GPS privacy** (M, UploadWizard only warns): remove GPS from the EXIF before uploading, per file or batch, or leave out the location.
- **More EXIF** (S): camera model, focal length, orientation-aware thumbnails.
- **Template choice** (S): `{{Photograph}}` or `{{Artwork}}` instead of `{{Information}}`; an “other information” wikitext column.
- **Multilingual descriptions** (M, UploadWizard): one column per language instead of language templates.
- **Category suggestions from history** (S, UploadWizard): recently used categories first.
- **Unit tests for the store** (S): `applyTable`, title checks, presets.
- **Downloadable CSV template** (S) and the CSV format in the README.

## Structured data

- **Depicts from categories** (M, Cat2Data, AC/DC): the Wikidata item of a category (via its infobox or P373) as depicts suggestion.
- **Depicts from location** (M, WCQS): Wikidata items near the photo (`wikibase:around`) as suggestions.
- **Wikidata reconciliation for pasted text** (M, OpenRefine): match pasted names to items, confirm candidates.
- **Quick yes/no for suggested depicts** (M, WikiCrowd, Depictor): card view with thumbnail and suggestion.
- **Enrich files already on Commons** (M, ISA, SDC tool): for photos skipped as duplicates, show and add missing captions and statements.
- **Default statements in presets** (S, OpenRefine schemas): e.g. creator as own Wikidata item, or a fixed depicts.
- **Batch verification links** (S, Media Search, WCQS): `haswbstatement:`/`incategory:` search and a WCQS map of the batch.
- **Show labels of depicted items** (S): fetch labels for the Q-IDs in the table and review.

## Campaigns

- **UploadWizard campaigns** (M/L): load `Campaign:X` JSON (`?campaign=X`): defaults, `autoAdd` categories and wikitext, custom fields, restricted licenses, start/end, tracking category.
- **URL parameters** (S, UploadWizard): prefill defaults (`categories`, `description`, `caption`, `lat`, `lon`, …) from the URL, e.g. for Wiki Loves Monuments lists.

## Done

Test mode (Test Commons, Test Wikipedia), file name patterns, category suggestions (search and nearby) and nonexistent-category warnings, captions in several languages, depicts, structured data derived from the table (inception, point of view and heading, license, copyright status, own work and creator), edit selected rows, presets, MediaInfo IDs, gallery and QuickStatements export after uploading.
