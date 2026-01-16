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
  book_published?: string;
  book_published_year?: string;
  book_published_at?: string;
  book_image_url?: string;
  book_large_image_url?: string;
  book_small_image_url?: string;
  author_name?: string;
  user_rating?: string;
  user_read_at?: string;
  description?: string;
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

function parseYear(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const match = value.match(/\b(18|19|20)\d{2}\b/u);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function bookUrlFromId(bookId: string | undefined, fallback?: string): string {
  if (!bookId) {
    return fallback ?? "";
  }
  return `https://www.goodreads.com/book/show/${bookId}`;
}

function extractImageFromHtml(html?: string): string | undefined {
  if (!html) {
    return undefined;
  }
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function pickImageUrl(item: GoodreadsRssItem): string | undefined {
  const candidates = [
    item.book_large_image_url,
    item.book_image_url,
    item.book_small_image_url,
    extractImageFromHtml(item.description)
  ];
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function pickPublicationYear(item: GoodreadsRssItem): number | undefined {
  const candidates = [
    item.book_published,
    item.book_published_year,
    item.book_published_at,
    item.description
  ];
  for (const candidate of candidates) {
    const year = parseYear(candidate);
    if (year) {
      return year;
    }
  }
  return undefined;
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
        imageUrl: pickImageUrl(item),
        year: pickPublicationYear(item),
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
