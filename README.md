# DinoFoto

Batch upload a local directory of photos to [Wikimedia Commons](https://commons.wikimedia.org/), built with Vue and [Codex](https://doc.wikimedia.org/codex/), the Wikimedia design system. Inspired by [Pattypan](https://commons.wikimedia.org/wiki/Commons:Pattypan) and [VicuñaUploader](https://commons.wikimedia.org/wiki/Commons:Vicu%C3%B1aUploader), but runs in the browser.

## Features

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
