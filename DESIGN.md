---
name: IM Review
description: Dense desktop Operate UI for GitHub PR triage and AI-assisted review.
colors:
  ink: "#171717"
  ink-soft: "#737373"
  paper: "#fafafa"
  paper-raised: "#ffffff"
  paper-dark: "#0a0a0a"
  ink-dark: "#f5f5f5"
  border: "#e5e5e5"
  border-dark: "#262626"
  danger: "#dc2626"
  success: "#059669"
  favorite: "#fbbf24"
typography:
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "#262626"
    textColor: "{colors.paper}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  surface-card:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0"
---

# Design System: IM Review

## Overview

**Creative North Star: "The Review Desk"**

*(Inferred from incumbent code during `/impeccable document` scan — not a user-named metaphor. Confirm or rename anytime.)*

IM Review's shipped UI is a quiet, dense desktop tool surface: Inter + Tailwind neutrals, light paper backgrounds, flat bordered lists, and sparse amber/emerald/red status accents. It prioritizes scanability of PR queues and review workflows over brand theater. Depth comes from borders and tonal surfaces, not shadows or gradients.

**Key Characteristics:**
- Flat Operate density (lists, tabs, compact headers)
- Neutral ink/paper palette with light + dark themes
- Inter for UI; monospace only for repo/branch/path metadata
- Lucide icons; no emoji-as-icon
- Borders and soft fills for structure; almost no elevation shadows

## Colors

A restrained neutral system with rare semantic accents.

### Primary
- **Graphite Ink** (#171717 / Tailwind `neutral-900`): Primary buttons and strong text in light mode.

### Secondary
- *None as a brand accent.* Secondary actions use outline/ghost neutrals.

### Tertiary
- **Favorite Amber** (#fbbf24 / `amber-400`): Star/favorite affordances only.
- **Signal Emerald** (#059669): Success / connected / positive meta.
- **Alert Red** (#dc2626 / `red-600`): Destructive actions and error banners.

### Neutral
- **Cool Paper** (#fafafa / `neutral-50`): App background (light).
- **Raised Paper** (#ffffff): Cards, list shells.
- **Soft Ink** (#737373 / `neutral-500`): Secondary labels and meta.
- **Hairline Border** (#e5e5e5 / `neutral-200`): List and section borders.
- **Night Paper** (#0a0a0a / `neutral-950`): Dark-mode body background.
- **Night Ink** (#f5f5f5 / `neutral-100`): Dark-mode primary text.

### Named Rules
**The Quiet Accent Rule.** Amber, emerald, and red appear only for status or favorite semantics — never as large brand washes or hero gradients.

## Typography

**Display Font:** Inter (same as body; no separate display face shipped)
**Body Font:** Inter (`@fontsource/inter` 400/500/600)
**Label/Mono Font:** system UI monospace for `owner/repo`, branches, paths

**Character:** Neutral product sans — legible at 12–14px in dense lists; hierarchy via weight and size, not decorative fonts.

### Hierarchy
- **Title** (600, ~20px / `text-xl` or `text-lg`): Page and PR titles.
- **Body** (400, 14px / `text-sm`): Primary readable content.
- **Label** (500–600, 12px / `text-xs`, often uppercase tracking on section headers): Meta, filters, section labels.
- **Mono** (400, 12px): Repo keys, branches, file paths.

### Named Rules
**The One Family Rule.** Do not introduce a second UI sans (e.g. IBM Plex) into shipped screens unless PRODUCT/DESIGN are intentionally redesigned together.

## Layout

Desktop-first single-column app chrome: compact top bars, full-width list panels, bordered rounded containers (`rounded-lg`), generous empty states (`py-16`). Spacing follows Tailwind 4/8/16/24 rhythm. PR detail uses tabbed content (detail / files / reviews / AI) rather than multi-column dashboards.

## Elevation & Depth

Mostly flat. Cards and lists use 1px borders + surface color changes. Inputs may use a subtle `shadow-sm`. No glow, glassmorphism, or multi-layer drop shadows.

### Named Rules
**The Flat-By-Default Rule.** Prefer border + background shift over shadow for grouping.

## Shapes

Consistent small radii: controls `rounded-md` (~6px), panels `rounded-lg` (~8px). Rectangular list rows with dividers. No pill-heavy chrome.

## Components

### Buttons
- **Shape:** `rounded-md`, height 36px default (`h-9`)
- **Primary:** Graphite fill / paper text; hover darker graphite
- **Outline / Ghost:** Neutral borders or hover wash
- **Destructive:** Red-600 fill
- **Focus:** `ring-2 ring-neutral-400`

### Cards / Containers
- **Corner Style:** `rounded-lg`
- **Background:** white / dark neutral-950
- **Border:** neutral-200 / neutral-800
- **Shadow Strategy:** none by default

### Inputs / Fields
- **Style:** bordered, white/dark fill, `h-9`, `rounded-md`
- **Focus:** neutral ring
- **Placeholder:** neutral-400

### Navigation
Header row with product/context title, icon buttons (Settings, Repos, Logout), and filter toggles. PR detail uses text/tabs for mode switching.

### Status chips
Small tinted pills for review state (e.g. red/amber/neutral backgrounds) — semantic only.

## Do's and Don'ts

### Do:
- **Do** keep list density high and meta in `text-xs` / mono where appropriate.
- **Do** support light and dark via `html.dark` + neutral pairs.
- **Do** use Lucide icons at ~14–16px beside labels.
- **Do** treat `design-system/pr-helper/MASTER.md` as a *proposal* unless a redesign is explicitly approved.

### Don't:
- **Don't** ship purple-gradient SaaS chrome, glow shadows, or emoji icon rows on Operate screens.
- **Don't** replace Inter globally without an explicit redesign pass.
- **Don't** invent marketing hero layouts inside the authenticated app shell.
- **Don't** treat Pro Max dark slate/gold tokens as incumbent until DESIGN.md is rewritten for that world.
