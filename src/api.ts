import "dotenv/config";
import express from "express";
import { config } from "./config";
import { buildMediaPayload } from "./normalize";
import { loadBooks, loadMovies } from "./store";

const app = express();

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
