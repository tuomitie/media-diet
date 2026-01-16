export interface MediaBase {
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  year?: number;
  rating?: number;
  dateConsumed?: string;
}

export interface MovieEntry extends MediaBase {
  type: "movie";
  rewatch?: boolean;
}

export interface BookEntry extends MediaBase {
  type: "book";
  author?: string;
}

export interface MediaPayload {
  generatedAt: string;
  movies: MovieEntry[];
  books: BookEntry[];
}
