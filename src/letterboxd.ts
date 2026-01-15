import { XMLParser } from "fast-xml-parser";
import { MovieEntry } from "./models";

type LetterboxdItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  "letterboxd:memberRating"?: string;
  "letterboxd:rewatch"?: string;
};

function extractIdFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last || url;
  } catch {
    return url;
  }
}

function normalizeMovieUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 3 && parts[1] === "film") {
      parsed.pathname = `/film/${parts[2]}/`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function parseRating(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseRewatch(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }
  if (value === "false" || value === "0" || value === "no") {
    return false;
  }
  return undefined;
}

function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.replace(/\s*-\s*[★½]+$/u, "").trim();
}

export async function fetchLetterboxdMovies(
  username: string
): Promise<MovieEntry[]> {
  const url = `https://letterboxd.com/${encodeURIComponent(username)}/rss/`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Letterboxd RSS failed: ${response.status}`);
  }
  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true
  });
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: LetterboxdItem[] | LetterboxdItem } };
  };
  const items = parsed.rss?.channel?.item ?? [];
  const normalized = Array.isArray(items) ? items : [items];
  const movies = normalized
    .map((item): MovieEntry | null => {
      if (!item.link || !item.title) {
        return null;
      }
      return {
        id: extractIdFromUrl(item.link),
        type: "movie",
        title: normalizeTitle(item.title),
        url: normalizeMovieUrl(item.link),
        rating: parseRating(item["letterboxd:memberRating"]),
        dateConsumed: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
        rewatch: parseRewatch(item["letterboxd:rewatch"])
      };
    })
    .filter((entry): entry is MovieEntry => Boolean(entry));

  return movies.sort((a, b) => {
    const aTime = a.dateConsumed ? new Date(a.dateConsumed).getTime() : 0;
    const bTime = b.dateConsumed ? new Date(b.dateConsumed).getTime() : 0;
    return bTime - aTime;
  });
}
