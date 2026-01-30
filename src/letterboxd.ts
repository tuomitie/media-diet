import { XMLParser } from "fast-xml-parser";
import { MovieEntry } from "./models";

type LetterboxdItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  "letterboxd:filmYear"?: string;
  "letterboxd:memberRating"?: string;
  "letterboxd:rewatch"?: string;
  "media:thumbnail"?: unknown;
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

function parseRewatch(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const lower = value.toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") {
    return true;
  }
  if (lower === "false" || lower === "0" || lower === "no") {
    return false;
  }
  return undefined;
}

function extractImageFromHtml(html?: string): string | undefined {
  if (!html) {
    return undefined;
  }
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function extractMediaUrl(media: unknown): string | undefined {
  if (!media) {
    return undefined;
  }
  if (typeof media === "string") {
    return media;
  }
  if (Array.isArray(media)) {
    for (const entry of media) {
      const url = extractMediaUrl(entry);
      if (url) {
        return url;
      }
    }
    return undefined;
  }
  if (typeof media === "object") {
    const record = media as Record<string, unknown>;
    const direct = record["@_url"] ?? record.url;
    if (typeof direct === "string") {
      return direct;
    }
  }
  return undefined;
}

function pickImageUrl(item: LetterboxdItem): string | undefined {
  return extractMediaUrl(item["media:thumbnail"]) ?? extractImageFromHtml(item.description);
}

function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  const withoutRating = trimmed.replace(/\s*-\s*[★½]+$/u, "").trim();
  const withoutParenYear = withoutRating.replace(/\s*\((18|19|20)\d{2}\)\s*$/u, "");
  return withoutParenYear.replace(/,\s*(18|19|20)\d{2}\s*$/u, "").trim();
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
        imageUrl: pickImageUrl(item),
        year: parseYear(item["letterboxd:filmYear"]),
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
