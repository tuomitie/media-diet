# Media Diet

Media Diet is a small Node + TypeScript microservice that syncs Letterboxd and Goodreads activity into JSON files and serves them via a read-only HTTP API.

## Features

- Nightly sync from Letterboxd RSS and Goodreads shelf HTML
- JSON output for movies, books, and combined payload
- Optional Cloudflare Pages deploy hook trigger on changes
- Read-only API for use by Astro or other consumers

## Requirements

- Node.js 20+
- A public Letterboxd username
- A Goodreads shelf RSS URL

## Setup

1. Copy `.env.example` to `.env` and fill in values.
2. Install dependencies and build:

```
npm install
npm run build
```
Set `GOODREADS_RSS_URL` to your Goodreads shelf RSS URL.

## Run the API

```
npm start
```

## Run a one-off sync

```
npm run sync
```

## Docker

Build and run the API container:

```
docker build -t media-diet .
docker run -d --name media-diet-api --env-file .env -p 127.0.0.1:8787:8787 -v "$(pwd)/data:/app/data" media-diet
```

Run a one-off sync with the same data volume:

```
docker run --rm --env-file .env -v "$(pwd)/data:/app/data" media-diet npm run sync
```

## API

- `GET /healthz`
- `GET /api/movies.json`
- `GET /api/books.json`
- `GET /api/media.json`
