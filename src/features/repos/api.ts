import { api } from "@/lib/api";

import type { Repo } from "./types";

type GhRepo = {
  id: number;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  updated_at: string;
  language: string | null;
};

function mapRepo(r: GhRepo): Repo {
  return {
    id: r.id,
    fullName: r.full_name,
    description: r.description,
    private: r.private,
    htmlUrl: r.html_url,
    updatedAt: r.updated_at,
    language: r.language,
  };
}

const PER_PAGE = 100;
const MAX_PAGES = 5;

/** Fetch repos for the authenticated user (owner + member + collaborator). */
export async function fetchAllRepos(): Promise<Repo[]> {
  const all: Repo[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await api.githubGet<GhRepo[]>(
      `/user/repos?per_page=${PER_PAGE}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch.map(mapRepo));
    if (batch.length < PER_PAGE) break;
  }
  return all;
}
