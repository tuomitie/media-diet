import { XMLParser } from "fast-xml-parser";
import { BookEntry } from "./models";

function normalizeText(value: string | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

type GoodreadsRssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  book_id?: string;
  author_name?: string;
  user_rating?: string;
  user_read_at?: string;
};

function parseRssRating(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseRssDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function bookUrlFromId(bookId: string | undefined, fallback?: string): string {
  if (!bookId) {
    return fallback ?? "";
  }
  return `https://www.goodreads.com/book/show/${bookId}`;
}

export async function fetchGoodreadsRssBooks(
  rssUrl: string
): Promise<BookEntry[]> {
  const response = await fetch(rssUrl);
  if (!response.ok) {
    throw new Error(`Goodreads RSS failed: ${response.status}`);
  }
  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true
  });
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: GoodreadsRssItem[] | GoodreadsRssItem } };
  };
  const items = parsed.rss?.channel?.item ?? [];
  const normalized = Array.isArray(items) ? items : [items];
  const books = normalized
    .map((item): BookEntry | null => {
      const readAt = parseRssDate(item.user_read_at);
      if (!readAt) {
        return null;
      }
      if (!item.book_id && !item.link) {
        return null;
      }
      const title = normalizeText(item.title);
      if (!title) {
        return null;
      }
      const id = item.book_id ?? item.link ?? title;
      return {
        id,
        type: "book",
        title,
        url: bookUrlFromId(item.book_id, item.link),
        author: normalizeText(item.author_name) || undefined,
        rating: parseRssRating(item.user_rating),
        dateConsumed: readAt
      };
    })
    .filter((entry): entry is BookEntry => Boolean(entry));

  return books.sort((a, b) => {
    const aTime = a.dateConsumed ? new Date(a.dateConsumed).getTime() : 0;
    const bTime = b.dateConsumed ? new Date(b.dateConsumed).getTime() : 0;
    return bTime - aTime;
  });
}
