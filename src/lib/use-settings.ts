import { useSyncExternalStore } from "react";

import type { FavoriteBranch, SavedReview } from "@/features/pr/types";
import {
  type AppSettings,
  type CommentTemplate,
  getFavoriteBranches,
  getFavorites,
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

export function useSavedReviews(): SavedReview[] {
  return useSyncExternalStore(
    subscribeSettings,
    getSavedReviews,
    getSavedReviews,
  );
}
