import type { ReviewEvent } from "@/features/pr/types";

export type AiSeverity = "info" | "warning" | "critical";

export type AiFinding = {
  id: string;
  severity: AiSeverity;
  title: string;
  body: string;
  path?: string;
  line?: number;
  included: boolean;
};

export type AiReviewDraft = {
  prKey: string;
  summary: string;
  findings: AiFinding[];
  suggestedEvent: ReviewEvent;
  rawText: string;
  createdAt: string;
};
