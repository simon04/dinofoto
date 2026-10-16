# DinoFoto

Batch upload a local directory of photos to [Wikimedia Commons](https://commons.wikimedia.org/), built with Vue and [Codex](https://doc.wikimedia.org/codex/), the Wikimedia design system. Inspired by [Pattypan](https://commons.wikimedia.org/wiki/Commons:Pattypan) and [VicuñaUploader](https://commons.wikimedia.org/wiki/Commons:Vicu%C3%B1aUploader), but runs in the browser.

## Features

The workflow is split into four steps (tabs, each with the number of files, and a button to the next step), so that 100+ photos can be prepared and then uploaded in one go without intermediate halts.

### 1. Files

- Open a local directory with the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) (Chrome, Edge and other Chromium-based browsers); nothing leaves the computer until the upload
- Pictures in subdirectories are included (JPEG, PNG, GIF, TIFF, WebP, SVG), hidden files and directories (`.*`) are skipped, sorted in natural order (`IMG_2` before `IMG_10`)
- Each picture is hashed (SHA-1) in the browser and looked up on Commons (`list=allimages&aisha1=…`); pictures already on Commons are hidden (toggle to show them, with a link to the existing file), duplicates within the directory are flagged
- Hashes are cached in localStorage by path, size and modification time, so reopening a directory is instant
- Live progress and counts (new, on Commons, duplicates, errors); thumbnails from the embedded EXIF thumbnail (no decoding of the full image), created lazily when scrolled into view

### 2. Describe

- All new pictures in one spreadsheet-like table: file name (the extension is kept), description, caption, date, categories, depicts, latitude, longitude, camera heading; optionally author, source and license per file
- Prefilled from the file name and EXIF: date taken (`DateTimeOriginal`), GPS position and camera heading ([exifr](https://github.com/MikeKovarik/exifr), reads only the metadata, not the whole file)
- Defaults for all files: description language, description, categories (added to every file), author (empty: your user page), source (`{{own}}`) and license (`{{self|cc-by-sa-4.0}}` or other presets, or any license template)
- **Structured data**: caption (plain text in the description language, or several languages as `en: Cloth Hall | de: Tuchhallen`; max. 250 characters each; a button in the column header fills empty captions from the descriptions, one per language template) and depicts (Wikidata items, `Q943; Q42`, with search by label as you type) per file; shown in the review and saved after each upload as caption and depicts (P180) statements
- **Category suggestions** in the table and the defaults: Commons categories matching the one being typed (each `;`-separated entry separately), and, for photos with a location, the most common categories of Commons files within 300 m (categories with a year left out, as they belong to other dates)
- **Presets**: save the defaults under a name (e.g. per project or campaign) and load them later; kept in this browser
- Enter / Shift+Enter moves to the same column in the next / previous row; “fill down” per column copies values into the empty cells below
- Select which files to upload (checkbox per row, select all); click a thumbnail for a large preview
- **File name pattern** for the selected files, e.g. `Kraków – Market Square ({nn})`, with a preview: `{n}`/`{nn}`/`{nnn}` (number, zero-padded, from a chosen start), `{title}` (current name), `{file}` (original file name), `{folder}` (directory), `{date}` (day taken), `{description}` (description as plain text); can be undone
- **Edit selected**: set a value in one column for all files selected for upload (like VicuñaUploader’s group edit and AC/DC): replace, append (categories and depicts as further `;` entries) or fill only empty cells, with category and Wikidata suggestions; can be undone
- **Paste CSV**: a table from a spreadsheet (tab-separated) or CSV (comma or semicolon, RFC 4180 quoting); the header row names the columns (`file`, `title`, `description`, `caption`, `date`, `categories`, `depicts`, `latitude`, `longitude`, `heading`, `author`, `source`, `license`, and aliases such as `path`, `lat`, `lon`); a `file` column matches rows to pictures by path or file name, otherwise rows are applied in table order; unknown columns and unmatched rows are reported
- **Paste cells** copied from a spreadsheet into any cell: they fill the table from that cell to the right and downwards
- **Copy table** (tab-separated, to paste into a spreadsheet, edit there and paste back) and **Download CSV**
- Every paste can be undone from the toast
- Everything is saved in localStorage, keyed by SHA-1: metadata survives reloads, reopening the directory, and even renaming or moving files

### 3. Review

- Pattypan-style list of all selected files with the resulting file description page: `{{Information}}` (description wrapped in a language template, date, source, author), `{{Location}}` with camera heading, license section and categories
- Rendered preview of the page (Action API `action=parse`), or the wikitext
- Checks per file; errors skip the file, warnings don’t:
  - errors: empty file name, forbidden characters (`# < > [ ] | { } / : \ ~~~`), longer than 240 bytes, same name as another selected file, name already taken on the target wiki (checked in batches of 50 when the step opens), missing license, author or source
  - warnings: categories that do not exist on Commons (checked together with the file names), camera-generated names (`IMG_1234`, `DSC…`, `PXL…`), file extension in the name, missing description, date or categories, invalid coordinates
- Counts of files ready, with errors and with warnings

### 4. Upload

- Log in with your Wikimedia account (OAuth 2.0 with PKCE in a popup, so the opened directory and edits are kept); only on https://dinofoto.toolforge.org/, where the registered callback is served; runs entirely in the browser, the token is kept in sessionStorage and renewed with the refresh token
- One click uploads all valid files one after another (`action=upload`, multipart, `assertuser`), with an editable upload summary; no confirmation per file
- Runs unattended: network errors, expired tokens and rate limits are retried with backoff; files stopped by warnings (e.g. `exists`, `duplicate`) or errors are reported and skipped, the batch continues
- Afterwards, per file: “Upload anyway” for warnings (publishes the stashed file, `filekey` + `ignorewarnings`, without uploading it again) and “Retry” for errors
- Statements derived from the table, like OpenRefine and UploadWizard add them: inception (P571, day/month/year precision) from the date, coordinates of the point of view (P1259) with heading (P7787), copyright license (P275) and status (P6216) for CC BY, CC BY-SA (3.0/4.0) and CC0, and for own work (source `{{own}}`, uploader as author) source of file (P7482) and creator (P170, unknown value with author name, Wikimedia username and user page URL); all listed in the review
- Captions and statements are saved right after each upload (`wbeditentity` on the file's MediaInfo entity `M<page ID>`); if that fails, the upload still counts and the error is shown. Test Commons gets captions only (its statements would refer to test.wikidata.org), Test Wikipedia neither
- After uploading: the MediaInfo ID of each file (linked), a link to your uploads, **Copy gallery** (`<gallery>` wikitext with captions) and **Copy QuickStatements** (captions and statements of the uploaded files, e.g. to save them with [QuickStatements](https://quickstatements.toolforge.org/) if saving failed)
- **Test mode**: upload to [Test Commons](https://test-commons.wikimedia.org/) or [Test Wikipedia](https://test.wikipedia.org/) instead of Commons to try out a batch, with a warning while selected; file names are checked against the selected wiki, and uploads are tracked per wiki
- Pause after the current file, resume later; uploaded files are not uploaded again
- Progress by files and bytes, links to the uploaded files
- Keeps the screen awake (Wake Lock API) and warns before closing the tab while uploading
- Files larger than 100 MiB are rejected in the review (chunked upload is not implemented yet)

### Languages and design

- UI in English, German, Spanish, French, Polish, Russian, Chinese and Arabic (`src/i18n/*.json`, loaded on demand, MediaWiki-style `$1` and `{{PLURAL:…}}` with CLDR plural forms); searchable selector over all Wikimedia languages, defaulting to the browser language
- Right-to-left layout for Arabic, Hebrew, Persian and other RTL languages
- Built with [Codex](https://doc.wikimedia.org/codex/) components and design tokens, dark mode follows the system setting

## Development

```sh
pnpm install   # also installs the Git pre-commit hook (vp config)
pnpm dev       # development server with hot reload
pnpm build     # type-check (vue-tsc) and build to dist/
pnpm preview   # serve the production build from dist/
pnpm test      # unit tests (Vitest, happy-dom); also run in CI
pnpm vp check  # format, lint and type checks
```

Node.js and pnpm versions are pinned in `.tool-versions` (asdf/mise).

Logging in locally uses the OAuth 2.0 consumer “DinoFoto (dev)” with the callback `http://localhost:5173/oauth-callback`, so the dev server is fixed to port 5173. Client IDs are in `.env.development` and `.env.production` (public clients, no secrets). Register the consumers at [Special:OAuthConsumerRegistration](https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose/oauth2) as public clients with the grants _basic_, _editpage_, _createeditmovepage_, _uploadfile_ and _uploadeditmovefile_.

Tooling is [Vite+](https://viteplus.dev/) (`vp`), configured in `vite.config.ts` (`fmt`, `lint`, `staged`). The pre-commit hook (`.vite-hooks/`) runs `vp check --fix` on staged files.

CI builds on every push and deploys `master` to GitHub Pages (and Toolforge, if `TOOLFORGE_DEPLOY_TOKEN` is set).

## Deployment

The tool is deployed on [Toolforge](https://wikitech.wikimedia.org/wiki/Help:Toolforge/Deploy_your_tool) at https://dinofoto.toolforge.org/ using the build service. `toolforge.yaml` declares a single continuous component published at `/`; the `web` process in the `Procfile` serves the Vite build output via `server.js`.

```sh
become dinofoto
toolforge components config create toolforge.yaml
toolforge components deployment create
```

Pushes to `master` deploy automatically once a deploy token (`toolforge components deploy-token create`) is stored as the `TOOLFORGE_DEPLOY_TOKEN` GitHub Actions secret.

## License

[GPL-3.0](LICENSE) © Simon Legner
