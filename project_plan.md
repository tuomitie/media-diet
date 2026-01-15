# Media Sync Service "Media Diet" (Project Plan)

## Goal

Build a small **Node + TypeScript** microservice (Dockerized, running on a homelab) that:

- Runs nightly:
  - Fetches latest **movies** from **Letterboxd** via a public RSS feed.
  - Fetches latest **books** from **Goodreads** by scraping the user’s public “read” shelf HTML.
  - Normalizes and writes results to JSON files.
  - Detects changes; if anything changed, triggers a **Cloudflare Pages Deploy Hook** to rebuild an Astro site.
- Also serves the normalized data over a small, read-only HTTP API that is exposed publicly via **Cloudflare Tunnel** and protected by **Cloudflare Access (service token)**.

This plan assumes no official developer keys/API access and relies on public endpoints only for data ingestion.

## Constraints / assumptions

- Personal use only; keep traffic low (once per day, no aggressive crawling).
- Small dataset (~100 movies/year, ~30 books/year).
- Astro site hosted on Cloudflare Pages; build-time env vars are configured in Pages settings.
- The sync service runs on a homelab (Docker available).
- Cloudflare Pages build cannot join your private network; Astro must fetch over normal HTTPS, hence Cloudflare Tunnel + Access.

## End-to-end data flow

1. Nightly job on homelab runs the sync container.
2. Container fetches/updates `data/movies.json` and `data/books.json` (and optionally `data/media.json`).
3. If content changed, container `POST`s Cloudflare Pages Deploy Hook to rebuild the site.
4. During the Pages build, Astro fetches `https://media.example.com/api/media.json` (behind Cloudflare Access) using a service token.

## Repository structure

```text
media-sync/
  src/
    config.ts
    models.ts
    letterboxd.ts
    goodreads.ts
    normalize.ts
    store.ts
    diff.ts
    api.ts
    deploy.ts
    run.ts
  data/
    movies.json      # created at runtime, initially missing
    books.json       # created at runtime, initially missing
    media.json       # optional combined output
  .env.example
  package.json
  tsconfig.json
  Dockerfile
  docker-compose.yml (optional)
  README.md

## Data models

Create stable, source-agnostic models in `src/models.ts`.

export interface MediaBase {
  id: string;                 // stable ID derived from source (film slug, book id)
  title: string;
  url: string;
  rating?: number;            // 0–5 (optionally allow halves)
  dateConsumed?: string;      // ISO 8601 if available
}

export interface MovieEntry extends MediaBase {
  type: 'movie';
  rewatch?: boolean;
}

export interface BookEntry extends MediaBase {
  type: 'book';
  author?: string;
}

export interface MediaPayload {
  generatedAt: string;        // ISO timestamp
  movies: MovieEntry[];
  books: BookEntry[];
}

## Configuration (obfuscated)

Environment variables for the sync service:

- `LETTERBOXD_USERNAME` – your Letterboxd username.
- `GOODREADS_READ_URL` – your public Goodreads “read” shelf URL.
- `DATA_DIR` – where JSON files are stored (default `./data`).
- `CF_PAGES_DEPLOY_HOOK_URL` – Cloudflare Pages deploy hook URL.
- `PORT` – API server port (default `8787` or `3000`).


**Do not** hardcode real usernames, IDs, hostnames, or hook URLs in git.

`.env.example`:

text

LETTERBOXD_USERNAME=your_letterboxd_username
GOODREADS_READ_URL=https://www.goodreads.com/review/list/<USER_ID>-<USER_SLUG>?shelf=read
DATA_DIR=./data
PORT=8787
CF_PAGES_DEPLOY_HOOK_URL=https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/<HOOK_ID>

Cloudflare Pages supports configuring environment variables in project settings. (Set for both Preview and Production if needed.)

## Cloudflare Tunnel + Access (public, authenticated)

## Tunnel routing

Run `cloudflared` in your homelab and route a hostname to the local API server.

Example `~/.cloudflared/config.yml` pattern:

text

`tunnel: <TUNNEL_UUID> credentials-file: /path/to/<TUNNEL_UUID>.json ingress:   - hostname: media.example.com    service: http://localhost:8787  - service: http_status:404`

This pattern (hostname → local service) is the standard way Cloudflare Tunnel maps a public hostname to a local HTTP service.

## Access protection (service token)

Protect `https://media.example.com/*` with Cloudflare Access, using a **service token** for non-interactive authentication.

Astro (in Cloudflare Pages build) will call the API with these headers:

- `CF-Access-Client-Id: <CLIENT_ID>`
- `CF-Access-Client-Secret: <CLIENT_SECRET>`

Cloudflare Access service tokens are explicitly intended for automated systems and come as a Client ID + Client Secret pair.

## API design (served by the microservice)

Serve read-only JSON endpoints from the homelab container (behind the tunnel):

- `GET /healthz` → `{ "ok": true }`
- `GET /api/movies.json` → array or payload
- `GET /api/books.json` → array or payload
- `GET /api/media.json` → `MediaPayload` (recommended)


Notes:

- The API itself does not need to implement auth if Cloudflare Access is always in front.
- Still, keep it bound to `localhost` or internal network only; rely on the tunnel to expose it.


## Source 1: Letterboxd (movies via RSS)

Use the public RSS feed:

- `https://letterboxd.com/<username>/rss/`


Implement in `src/letterboxd.ts`:

ts
`export async function fetchLetterboxdMovies(username: string): Promise<MovieEntry[]>;`

Requirements:

- Fetch RSS XML over HTTPS.
- Parse XML (`fast-xml-parser` or equivalent).
- Extract per item:
    - `title`
    - `url`
    - `dateConsumed` (from `pubDate`)
    - `rating` (my rating) if present (optional; parse stars if available)

- Generate stable `id` (derive from film URL slug if possible).
- Return sorted results (newest first).


## Source 2: Goodreads (books via HTML scraping)

Scrape the user’s public shelf list (read shelf):
- `https://www.goodreads.com/review/list/<USER_ID>-<USER_SLUG>?shelf=read`

Implement in `src/goodreads.ts`:

`export async function fetchGoodreadsBooks(readShelfUrl: string): Promise<BookEntry[]>;`

Requirements:

- Fetch HTML and parse with `cheerio`.
- Handle pagination gently:

    - Start with page 1.
    - Follow “next” links until none exist, or cap pages (e.g., 5–10).

- For each table row, extract best-effort:

    - Book page link; derive `id` from `/book/show/<ID>`
    - `title`
    - `author` (if available)
    - `rating` (my rating, if available)
    - `dateConsumed` / “date read” (if present)
- Return sorted results.

Politeness constraints:
- No concurrency; one request at a time.
- Once per day (or add option in .env).
- Optional: add a small randomized delay between pages.


## Storage layer

Implement `src/store.ts`:
- `loadMovies(): Promise<MovieEntry[]>`
- `saveMovies(movies: MovieEntry[]): Promise<void>`
- `loadBooks(): Promise<BookEntry[]>`
- `saveBooks(books: BookEntry[]): Promise<void>`
- `saveMedia(payload: MediaPayload): Promise<void>` (optional)


Requirements:

- Ensure `DATA_DIR` exists.
- On first run, missing JSON files should be treated as empty arrays.
- Write pretty JSON (2 spaces) for easier debugging.

## Change detection

Implement `src/diff.ts`:
- `hasChanged(oldData, newData): boolean`

Given the small dataset, simplest approach is fine:

- Canonicalize (sort) and compare `JSON.stringify(old) !== JSON.stringify(new)`.


## Cloudflare Pages deploy hook trigger

Implement `src/deploy.ts`:

- `triggerDeploy(): Promise<void>`

- `triggerDeployIfNeeded(changed: boolean): Promise<void>`


Requirements:

- If `CF_PAGES_DEPLOY_HOOK_URL` is not set, warn and skip.

- Otherwise `POST` to the hook URL.

- Log non-2xx responses (include response body).


## Main runner

Implement `src/run.ts` as the nightly job entrypoint:

1. Load env (`dotenv/config`).

2. Load previous JSON.

3. Fetch current movies/books.

4. Normalize + build `MediaPayload`.

5. Compare old vs new.

6. If changed:

    - Save updated JSON files.

    - Trigger Cloudflare Pages deploy hook.

7. Exit with non-zero code only on hard failures.


## API server

Implement `src/api.ts`:

- Minimal HTTP server (Express/Fastify/Hono or Node’s built-in HTTP).

- Serves the latest JSON files from disk.


Runtime modes (choose one):

- **Single container, two processes**: not ideal.

- **Single container, one process**: recommended → API always running, and nightly sync is executed by calling the container with a `sync` command, OR by a separate “sync” container.


Recommended approach:

- Container runs the API server (`node dist/api.js`) continuously.

- A nightly job runs `node dist/run.js` (either via `docker exec` into the running container, or by running a separate one-shot container that shares the same `DATA_DIR` volume).


## Dependencies

Suggested npm dependencies:

- Runtime:
    - `undici` (or `node-fetch`) for HTTP
    - `cheerio` for Goodreads parsing
    - `fast-xml-parser` for RSS parsing
    - `dotenv` for env loading
    - `express` (or `fastify`) for the API server
- Dev:
    - `typescript`
    - `ts-node` (optional)
    - `@types/node`


`package.json` scripts:

json

`{   "scripts": {    "build": "tsc",    "start": "node dist/api.js",    "sync": "node dist/run.js",    "dev": "ts-node src/api.ts"  } }`

## Dockerization

Create a multi-stage Dockerfile:

- Stage 1: install deps + compile TypeScript.
- Stage 2: install production deps + copy `dist/`.


Data persistence:

- Mount a persistent volume for `DATA_DIR`.


Example (conceptual):

- API container (long-running):

bash
`docker run -d \   --name media-sync-api \  --env-file .env \  -p 127.0.0.1:8787:8787 \  -v /path/on/host/media-sync-data:/app/data \  media-sync:latest`

- Nightly sync (one-shot) using same volume:

bash
`docker run --rm \   --env-file .env \  -v /path/on/host/media-sync-data:/app/data \  media-sync:latest npm run sync`

## Astro build-time fetch

In Astro build code, fetch the API using the Cloudflare Access service token headers:

- `CF-Access-Client-Id`
- `CF-Access-Client-Secret`


Pseudo-code:

const base = process.env.MEDIA_API_BASE_URL;
const res = await fetch(`${base}/api/media.json`, {
  headers: {
    'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID!,
    'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET!,
  }
});
if (!res.ok) throw new Error(`Media API failed: ${res.status}`);
const payload = await res.json();


## Implementation checklist

-  Scaffold Node + TypeScript project.
-  Implement Letterboxd RSS fetch + parsing.
-  Implement Goodreads shelf HTML fetch + parsing (with pagination + delays).
-  Implement JSON store + change detection.
-  Implement deploy hook trigger.
-  Implement read-only API server.
-  Dockerize.
-  Deploy on homelab.
-  Create Cloudflare Tunnel to route `media.example.com` → `http://localhost:8787`.
-  Protect route with Cloudflare Access; create service token.
-  Add Pages env vars and update Astro build to fetch data.
```
