# Unit matrix — ai-review

Feature slug: `ai-review`  
Modules: `diff-lines.ts`, `generate.ts` (pure), `providers.ts`  
Target: ≥90% lines on these files

| ID                | P   | Behavior                                                       | Reference       | Status | Remaining risk |
| ----------------- | --- | -------------------------------------------------------------- | --------------- | ------ | -------------- |
| UNIT-AIREVIEW-001 | P0  | Parse right-side lines from unified patch                      | `diff-lines.ts` | passed | —              |
| UNIT-AIREVIEW-002 | P0  | Multi-hunk patches                                             | `diff-lines.ts` | passed | —              |
| UNIT-AIREVIEW-003 | P1  | Skip `-` lines and `\\` no-newline markers                     | `diff-lines.ts` | passed | —              |
| UNIT-AIREVIEW-004 | P0  | `snapToCommentableLine` exact / nearest / too far / empty      | `diff-lines.ts` | passed | —              |
| UNIT-AIREVIEW-005 | P0  | `normalizeReviewPath` trim, `./`, backslash                    | `diff-lines.ts` | passed | —              |
| UNIT-AIREVIEW-006 | P0  | `parseAiReviewText` structured JSON                            | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-007 | P0  | Parse fenced `json` block                                      | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-008 | P0  | Unstructured fallback finding                                  | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-009 | P1  | Embedded `{...}` extraction; invalid severity/event → defaults | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-010 | P1  | Empty findings array; empty title/body defaults                | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-011 | P0  | `buildPatchContext` includes headers + binary placeholder      | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-012 | P1  | `buildPatchContext` respects file / char limits                | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-013 | P0  | `buildGithubReviewPayload` inline when path+line mappable      | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-014 | P0  | Payload body-only when missing path/line/patch/snap fails      | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-015 | P1  | Excludes non-included findings from payload                    | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-016 | P1  | `draftToReviewBody` includes only selected findings            | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-017 | P1  | `draftToRefineJson` all vs onlyIncluded                        | `generate.ts`   | passed | —              |
| UNIT-AIREVIEW-018 | P0  | `isAiProviderId` true/false for known set                      | `providers.ts`  | passed | —              |
| UNIT-AIREVIEW-019 | P2  | `AI_PROVIDERS` has unique ids + DEFAULT is cursor              | `providers.ts`  | passed | —              |

## Out of unit

`AiReviewPanel.tsx`, network `fetchChangedFiles` / Rust AI invoke.
