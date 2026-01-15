import { BookEntry, MediaPayload, MovieEntry } from "./models";

function sortByDateDesc<T extends { dateConsumed?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = a.dateConsumed ? new Date(a.dateConsumed).getTime() : 0;
    const bTime = b.dateConsumed ? new Date(b.dateConsumed).getTime() : 0;
    return bTime - aTime;
  });
}

export function buildMediaPayload(
  movies: MovieEntry[],
  books: BookEntry[]
): MediaPayload {
  return {
    generatedAt: new Date().toISOString(),
    movies: sortByDateDesc(movies),
    books: sortByDateDesc(books)
  };
}
