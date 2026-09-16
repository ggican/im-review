import { useSyncExternalStore } from "react";

import type { GoogleConnectionPublic } from "@/features/calendar/types";
import type {
  JiraConnectionPublic,
  JiraSavedFilter,
} from "@/features/jira/types";
import type { FavoriteUser } from "@/features/people/types";
import type { FavoriteBranch, SavedReview } from "@/features/pr/types";
import {
  type AppSettings,
  type CommentTemplate,
  getFavoriteBranches,
  getFavorites,
  getFavoriteUsers,
  getGooglePublic,
  getJiraPublic,
  getJiraSavedFilters,
  getJiraStatusTabOrder,
  getSavedReviews,
  getSettings,
  getTemplates,
  subscribeSettings,
} from "@/lib/settings";

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

export function useTemplates(): CommentTemplate[] {
  return useSyncExternalStore(subscribeSettings, getTemplates, getTemplates);
}

export function useFavorites(): string[] {
  return useSyncExternalStore(subscribeSettings, getFavorites, getFavorites);
}

export function useFavoriteBranches(): FavoriteBranch[] {
  return useSyncExternalStore(
    subscribeSettings,
    getFavoriteBranches,
    getFavoriteBranches,
  );
}

export function useFavoriteUsers(): FavoriteUser[] {
  return useSyncExternalStore(
    subscribeSettings,
    getFavoriteUsers,
    getFavoriteUsers,
  );
}

export function useJiraPublic(): JiraConnectionPublic | null {
  return useSyncExternalStore(subscribeSettings, getJiraPublic, getJiraPublic);
}

export function useJiraSavedFilters(): JiraSavedFilter[] {
  return useSyncExternalStore(
    subscribeSettings,
    getJiraSavedFilters,
    getJiraSavedFilters,
  );
}

export function useJiraStatusTabOrder(): string[] {
  return useSyncExternalStore(
    subscribeSettings,
    getJiraStatusTabOrder,
    getJiraStatusTabOrder,
  );
}

export function useGooglePublic(): GoogleConnectionPublic | null {
  return useSyncExternalStore(
    subscribeSettings,
    getGooglePublic,
    getGooglePublic,
  );
}

export function useSavedReviews(): SavedReview[] {
  return useSyncExternalStore(
    subscribeSettings,
    getSavedReviews,
    getSavedReviews,
  );
}
