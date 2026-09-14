export type FavoriteUser = {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  favoritedAt: string;
};

export type AuthorFilterMode = "filter" | "search";
