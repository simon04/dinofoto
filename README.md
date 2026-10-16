# DinoFoto

Batch upload a local directory of photos to [Wikimedia Commons](https://commons.wikimedia.org/), built with Vue and [Codex](https://doc.wikimedia.org/codex/), the Wikimedia design system. Inspired by [Pattypan](https://commons.wikimedia.org/wiki/Commons:Pattypan) and [VicuñaUploader](https://commons.wikimedia.org/wiki/Commons:Vicu%C3%B1aUploader), but runs in the browser.

## Features

The workflow is split into steps (tabs), so that 100+ photos can be prepared and then uploaded in one go without intermediate halts.

### 1. Files

- Open a local directory with the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) (Chrome, Edge and other Chromium-based browsers); nothing leaves the computer until the upload
- Pictures in subdirectories are included (JPEG, PNG, GIF, TIFF, WebP, SVG), hidden files and directories (`.*`) are skipped, sorted in natural order (`IMG_2` before `IMG_10`)
- Each picture is hashed (SHA-1) in the browser and looked up on Commons (`list=allimages&aisha1=…`); pictures already on Commons are hidden (toggle to show them, with a link to the existing file), duplicates within the directory are flagged
- Hashes are cached in localStorage by path, size and modification time, so reopening a directory is instant
- Live progress and counts (new, on Commons, duplicates, errors); thumbnails from the embedded EXIF thumbnail (no decoding of the full image), created lazily when scrolled into view

### 2. Describe

- All new pictures in one spreadsheet-like table: file name (the extension is kept), description, date, categories, latitude, longitude, camera heading; optionally author, source and license per file
- Prefilled from the file name and EXIF: date taken (`DateTimeOriginal`), GPS position and camera heading ([exifr](https://github.com/MikeKovarik/exifr), reads only the metadata, not the whole file)
- Defaults for all files: description language, description, categories (added to every file), author (empty: your user page), source (`{{own}}`) and license (`{{self|cc-by-sa-4.0}}` or other presets, or any license template)
- Enter / Shift+Enter moves to the same column in the next / previous row; “fill down” per column copies values into the empty cells below
- Select which files to upload (checkbox per row, select all); click a thumbnail for a large preview
- **Paste CSV**: a table from a spreadsheet (tab-separated) or CSV (comma or semicolon, RFC 4180 quoting); the header row names the columns (`file`, `title`, `description`, `date`, `categories`, `latitude`, `longitude`, `heading`, `author`, `source`, `license`, and aliases such as `path`, `lat`, `lon`); a `file` column matches rows to pictures by path or file name, otherwise rows are applied in table order; unknown columns and unmatched rows are reported
- **Paste cells** copied from a spreadsheet into any cell: they fill the table from that cell to the right and downwards
- **Copy table** (tab-separated, to paste into a spreadsheet, edit there and paste back) and **Download CSV**
- Every paste can be undone from the toast
- Everything is saved in localStorage, keyed by SHA-1: metadata survives reloads, reopening the directory, and even renaming or moving files

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
