import "dotenv/config";
import express from "express";
import { config } from "./config";
import { buildMediaPayload } from "./normalize";
import { loadBooks, loadMovies } from "./store";

function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string): boolean {
  return isLocalhostOrigin(origin) || config.corsOrigins.includes(origin);
}

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }
  next();
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/movies.json", async (_req, res) => {
  const movies = await loadMovies();
  res.json(movies);
});

app.get("/api/books.json", async (_req, res) => {
  const books = await loadBooks();
  res.json(books);
});

app.get("/api/media.json", async (_req, res) => {
  const [movies, books] = await Promise.all([loadMovies(), loadBooks()]);
  res.json(buildMediaPayload(movies, books));
});

app.listen(config.port, () => {
  console.log(`Media Diet API listening on ${config.port}`);
});
