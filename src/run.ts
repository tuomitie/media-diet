import "dotenv/config";
import { config } from "./config";
import { hasChanged } from "./diff";
import { triggerDeployIfNeeded } from "./deploy";
import { fetchGoodreadsRssBooks } from "./goodreads";
import { fetchLetterboxdMovies } from "./letterboxd";
import { buildMediaPayload } from "./normalize";
import { loadBooks, loadMovies, saveBooks, saveMedia, saveMovies } from "./store";

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  existing.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

async function run(): Promise<void> {
  if (!config.letterboxdUsername) {
    throw new Error("LETTERBOXD_USERNAME is required.");
  }
  if (!config.goodreadsRssUrl) {
    throw new Error("GOODREADS_RSS_URL is required.");
  }

  const [oldMovies, oldBooks] = await Promise.all([loadMovies(), loadBooks()]);
  const [fetchedMovies, fetchedBooks] = await Promise.all([
    fetchLetterboxdMovies(config.letterboxdUsername),
    fetchGoodreadsRssBooks(config.goodreadsRssUrl)
  ]);
  const newMovies = mergeById(oldMovies, fetchedMovies);
  const newBooks = mergeById(oldBooks, fetchedBooks);

  const moviesChanged = hasChanged(oldMovies, newMovies);
  const booksChanged = hasChanged(oldBooks, newBooks);
  const changed = moviesChanged || booksChanged;

  if (changed) {
    await Promise.all([saveMovies(newMovies), saveBooks(newBooks)]);
    await saveMedia(buildMediaPayload(newMovies, newBooks));
  }

  await triggerDeployIfNeeded(changed);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
