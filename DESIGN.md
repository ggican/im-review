---
name: IM Review
description: Technical Workspace desktop Operate UI for PR, Jira, Gmail, Calendar, and AI review.
colors:
  background: "#f9f9f8"
  surface: "#f9f9f8"
  surface-dim: "#d9dad9"
  surface-bright: "#f9f9f8"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f3f4f3"
  surface-container: "#edeeed"
  surface-container-high: "#e7e8e7"
  surface-container-highest: "#e1e3e2"
  surface-variant: "#e1e3e2"
  on-background: "#191c1c"
  on-surface: "#191c1c"
  on-surface-variant: "#3b4a47"
  inverse-surface: "#2e3131"
  inverse-on-surface: "#f0f1f0"
  chrome: "#111318"
  chrome-foreground: "#ffffff"
  chrome-muted: "#889096"
  chrome-recessed: "#1e222b"
  primary: "#3d8b82"
  on-primary: "#ffffff"
  primary-container: "#b6f3ec"
  on-primary-container: "#2f6b64"
  inverse-primary: "#9ad9d2"
  accent: "#b6f3ec"
  secondary: "#5d5e64"
  on-secondary: "#ffffff"
  secondary-container: "#dfdfe6"
  on-secondary-container: "#616269"
  tertiary: "#4a8f82"
  on-tertiary: "#ffffff"
  tertiary-container: "#d4f5ec"
  on-tertiary-container: "#2a6b5c"
  outline: "#6a7a77"
  outline-variant: "#b9cac6"
  border: "#e5e9e8"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  success: "#0e6e3e"
  success-container: "#e9f9f0"
  on-success-container: "#0e6e3e"
  warning: "#8a4c07"
  warning-container: "#fef6e9"
  on-warning-container: "#8a4c07"
  stream-github: "#e5faf7"
  stream-github-border: "#b6f3ec"
  stream-github-fg: "#2f6b64"
  stream-jira: "#fef6e9"
  stream-jira-border: "#fde2b8"
  stream-jira-fg: "#8a4c07"
  stream-gmail: "#edf4fe"
  stream-gmail-border: "#c6dcfc"
  stream-gmail-fg: "#194b8c"
  stream-calendar: "#f3effc"
  stream-calendar-border: "#ddcff7"
  stream-calendar-fg: "#4b2b85"
  stream-ai: "#e9f9f0"
  stream-ai-border: "#b5eed0"
  stream-ai-fg: "#0e6e3e"
  background-dark: "#0b0e14"
  surface-dark: "#111318"
  on-surface-dark: "#e5e7eb"
  on-surface-variant-dark: "#9aa3ad"
  border-dark: "#222733"
  primary-dark: "#7ec9c0"
  on-primary-dark: "#0a1f1d"
typography:
  headline-xl:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.22
  headline-lg:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.29
  headline-md:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.27
  headline-sm:
    fontFamily: "Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.33
  title-md:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.375
  body-lg:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.47
  body-md:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.46
  body-sm:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.42
  label-md:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.23
  label-sm:
    fontFamily: "Plus Jakarta Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.27
  code-md:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.38
  code-sm:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.36
  key-shortcut:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  "2xl": "1.5rem"
  window: "1.75rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.875rem"
  lg: "1.25rem"
  xl: "1.75rem"
  gutter: "1rem"
  margin: "1.25rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.on-primary-container}"
    textColor: "{colors.on-primary}"
  button-accent:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.md}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
  button-destructive:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-error}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  surface-card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xl}"
    padding: "0"
  badge:
    rounded: "{rounded.full}"
    fontSize: "0.625rem"
---

# Design System: IM Review

## Overview

**Creative North Star: "Technical Workspace"**

Aligned to the Google Stitch export (`docs/design/stitch-export/technical_workspace`) with a softer pastel brand. IM Review is a calm engineering work desk: soft chalk canvas, deep chrome navigation, muted mint accents, and dense scanable lists for PRs, Jira, Gmail, Calendar, and AI review.

**Key Characteristics:**
- Soft off-white canvas with layered surface containers
- Pastel mint (`#B6F3EC`) as primary-container / accent; muted teal (`#3D8B82`) for primary actions (light)
- Space Grotesk headlines, Plus Jakarta Sans body, JetBrains Mono metadata (Inter as shipped fallback until font packages land)
- Lucide icons (not Material Symbols)
- Soft card elevation + hairline borders; pill status badges

## Colors

### Brand & chrome
- **Primary** `#3D8B82` / dark `#7EC9C0`: primary actions
- **Primary container / Accent** `#B6F3EC` / dark `#1F4541`: focus rings, brand highlights, soft washes
- **Chrome** `#111318`: top navigation shell
- **Canvas** `#F9F9F8`: work surface background

### Semantic streams (pastel cards)
- GitHub: bg `#E5FAF7` / border `#B6F3EC` / fg `#2F6B64`
- Jira: bg `#FEF6E9` / border `#FDE2B8` / fg `#8A4C07`
- Gmail: bg `#EDF4FE` / border `#C6DCFC` / fg `#194B8C`
- Calendar: bg `#F3EFFC` / border `#DDCFF7` / fg `#4B2B85`
- AI / success mint: bg `#E9F9F0` / border `#B5EED0` / fg `#0E6E3E`

### Status
- Error `#BA1A1A`, Warning `#8A4C07`, Success `#0E6E3E`

### Named Rules
**The Pastel Accent Rule.** Large brand washes and focus rings use soft `primary-container` mint — never neon cyan. Graphite/neutral-only chrome stays on the dark top shell, not the whole app.

## Typography

**Display:** Space Grotesk (fallback Inter)  
**Body / UI:** Plus Jakarta Sans (fallback Inter)  
**Mono:** JetBrains Mono (fallback system mono)

### Hierarchy
- Headline XL→SM for section titles
- Title MD / Body LG–SM for content
- Label MD/SM for chips and filters
- Code MD/SM + key-shortcut (`0.625rem`) for `⌘K`, branches, issue keys

## Layout & Spacing

8px-adjacent rhythm via `xs/sm/md/lg/xl` plus `gutter` and `margin`. Desktop-first; foundation tokens only — page chrome composition comes later.

## Elevation & Depth

Cards use subtle dual-layer shadow + 1px `border`. Floating modules use stronger float shadow. Prefer surface-container steps over heavy gradients.

## Shapes

- Controls: `md` (0.75rem)
- Panels: `lg`–`xl`
- Status badges / pills: `full` (9999px)
- Window shell (mock only): `window` (1.75rem) — not used in Tauri chrome

## Components (foundation)

### Buttons
Primary (teal), accent (cyan container), outline, ghost, secondary, destructive; sizes sm/default/lg/icon.

### Icon buttons
Square `icon` / `icon-sm` using the same variants.

### Badges
Neutral, primary, accent, success, warning, error, outline, plus stream variants (github/jira/gmail/calendar/ai).

### Tabs
Pill track on `surface-container-low`; active trigger on `surface-container-lowest` with soft shadow.

### Cards
`surface-card` utility / `Card` primitive: lowest container, border, xl radius, card shadow.

### Inputs
Bordered fields on lowest surface; focus ring uses `primary-container`.

## Do's and Don'ts

### Do
- **Do** use semantic tokens (`bg-background`, `text-on-surface`, `border-border`) over raw neutrals for new UI.
- **Do** keep Lucide as the icon set.
- **Do** keep existing logo assets.

### Don't
- **Don't** ship fake macOS traffic lights inside the Tauri window.
- **Don't** paste Stitch HTML/CDN Tailwind/Material Symbols.
- **Don't** replace auth, APIs, or routes as part of the foundation pass.
