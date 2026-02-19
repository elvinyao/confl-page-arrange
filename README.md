# Confluence Page Arrange

A local web tool to load a Confluence page tree, rearrange pages via drag-and-drop, preview move operations, and commit move-only updates through Confluence APIs.

## Scope

- Supports Confluence Cloud and Data Center.
- Move-only operations (no content/title/body updates).
- Same-space moves only.
- Designed for trees up to about 500 pages.

## Localized and Offline UI Resources

- UI strings are local dictionary files in `apps/web/src/i18n/`.
- No remote CDN scripts/styles/fonts are used.
- Run `npm run check:assets` to enforce no remote UI asset references.

## Run

```bash
npm install
npm run dev
```

- Web app: `http://127.0.0.1:5173`
- API server: `http://127.0.0.1:8787`

## Run Desktop (Electron)

```bash
npm install
npm run dev:desktop
```

- Builds web/server artifacts, then launches Electron shell.
- Electron embeds the API server on `http://127.0.0.1:8787`.

## Build

```bash
npm run build
```

## Build Docker Image

```bash
npm install
docker build -t confl-page-arrange-api:local -f Dockerfile .
docker build -t confl-page-arrange-web:local -f Dockerfile.web .
```

- Run API-only container:

```bash
docker run --rm -p 8787:8787 confl-page-arrange-api:local
```

## Docker Compose (GHCR Image)

```bash
docker compose up -d --build
```

- Compose file: `docker-compose.yml` (`docker-compose.example.yml` is a copyable template)
- Frontend endpoint: `http://127.0.0.1:8080`
- API endpoint (for debugging): `http://127.0.0.1:8787` is internal only in compose; use `/api` from frontend.
- Update `NO_PROXY` / `no_proxy` if your Confluence host should bypass proxy.

## GitHub Actions (GHCR)

- Workflow: `.github/workflows/publish-ghcr.yml`
- Push a tag like `v0.1.1` (or run `workflow_dispatch`) to build and publish image to `ghcr.io/<owner>/<repo>`.
- Published tags include the git tag, commit sha tag, and `latest`.

## Test

```bash
npm run test
```
