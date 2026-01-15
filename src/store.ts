import { promises as fs } from "node:fs";
import path from "node:path";
import { BookEntry, MediaPayload, MovieEntry } from "./models";
import { config } from "./config";

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await ensureDataDir();
  const output = JSON.stringify(payload, null, 2);
  await fs.writeFile(filePath, `${output}\n`, "utf8");
}

export async function loadMovies(): Promise<MovieEntry[]> {
  const filePath = path.join(config.dataDir, "movies.json");
  return readJsonFile(filePath, []);
}

export async function saveMovies(movies: MovieEntry[]): Promise<void> {
  const filePath = path.join(config.dataDir, "movies.json");
  await writeJsonFile(filePath, movies);
}

export async function loadBooks(): Promise<BookEntry[]> {
  const filePath = path.join(config.dataDir, "books.json");
  return readJsonFile(filePath, []);
}

export async function saveBooks(books: BookEntry[]): Promise<void> {
  const filePath = path.join(config.dataDir, "books.json");
  await writeJsonFile(filePath, books);
}

export async function saveMedia(payload: MediaPayload): Promise<void> {
  const filePath = path.join(config.dataDir, "media.json");
  await writeJsonFile(filePath, payload);
}
