import { normalizeGithubLogin } from "@/features/people/login";
import type { FavoriteUser } from "@/features/people/types";
import { api } from "@/lib/api";

type GhUser = {
  login: string;
  name?: string | null;
  avatar_url?: string;
  html_url?: string;
};

type SearchUsersResponse = {
  items?: GhUser[];
};

function mapUser(raw: GhUser): Omit<FavoriteUser, "favoritedAt"> {
  return {
    login: raw.login,
    name: raw.name ?? null,
    avatarUrl: raw.avatar_url ?? "",
    htmlUrl: raw.html_url ?? `https://github.com/${raw.login}`,
  };
}

export async function searchGithubUsers(
  query: string,
): Promise<Omit<FavoriteUser, "favoritedAt">[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const data = await api.githubGet<SearchUsersResponse>(
    `/search/users?q=${encodeURIComponent(q)}&per_page=10`,
  );
  return (data.items ?? []).map(mapUser);
}

export async function fetchGithubUser(
  login: string,
): Promise<Omit<FavoriteUser, "favoritedAt">> {
  const normalized = normalizeGithubLogin(login);
  if (!normalized) {
    throw new Error("Invalid GitHub login");
  }
  const raw = await api.githubGet<GhUser>(
    `/users/${encodeURIComponent(normalized)}`,
  );
  return mapUser(raw);
}
