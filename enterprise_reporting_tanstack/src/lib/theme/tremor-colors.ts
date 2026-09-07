/**
 * Tremor design system colour primitives.
 *
 * Mirrors the palette used by the Tremor component library
 * (https://github.com/tremorlabs/tremor-npm) so that JavaScript consumers
 * (ECharts, Recharts, canvas exports, PDF exports) render with exactly the
 * same colours as the Tailwind-driven components.
 *
 * Values are the Tailwind CSS v3 default palette shades that Tremor builds on.
 */

/** Raw Tailwind shades Tremor references in its own tailwind.config.js. */
export const TAILWIND_SHADES = {
  white: "#ffffff",
  blue: {
    50: "#eff6ff",
    200: "#bfdbfe",
    400: "#60a5fa",
    500: "#3b82f6",
    700: "#1d4ed8",
    800: "#1e40af",
    950: "#172554",
  },
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
    950: "#030712",
  },
  emerald: { 500: "#10b981" },
  violet: { 500: "#8b5cf6" },
  amber: { 500: "#f59e0b" },
  cyan: { 500: "#06b6d4" },
  pink: { 500: "#ec4899" },
  lime: { 500: "#84cc16" },
  fuchsia: { 500: "#d946ef" },
  red: { 500: "#ef4444" },
  yellow: { 500: "#eab308" },
} as const;

/**
 * Tremor semantic tokens, light mode.
 * Identical structure to the `tremor` colour namespace in Tremor's Tailwind preset.
 */
export const TREMOR_LIGHT = {
  brand: {
    faint: TAILWIND_SHADES.blue[50],
    muted: TAILWIND_SHADES.blue[200],
    subtle: TAILWIND_SHADES.blue[400],
    DEFAULT: TAILWIND_SHADES.blue[500],
    emphasis: TAILWIND_SHADES.blue[700],
    inverted: TAILWIND_SHADES.white,
  },
  background: {
    muted: TAILWIND_SHADES.gray[50],
    subtle: TAILWIND_SHADES.gray[100],
    DEFAULT: TAILWIND_SHADES.white,
    emphasis: TAILWIND_SHADES.gray[700],
  },
  border: TAILWIND_SHADES.gray[200],
  ring: TAILWIND_SHADES.gray[200],
  content: {
    subtle: TAILWIND_SHADES.gray[400],
    DEFAULT: TAILWIND_SHADES.gray[500],
    emphasis: TAILWIND_SHADES.gray[700],
    strong: TAILWIND_SHADES.gray[900],
    inverted: TAILWIND_SHADES.white,
  },
} as const;

/**
 * Tremor semantic tokens, dark mode.
 * Identical structure to the `dark-tremor` colour namespace in Tremor's preset.
 */
export const TREMOR_DARK = {
  brand: {
    faint: "#0B1229",
    muted: TAILWIND_SHADES.blue[950],
    subtle: TAILWIND_SHADES.blue[800],
    DEFAULT: TAILWIND_SHADES.blue[500],
    emphasis: TAILWIND_SHADES.blue[400],
    inverted: TAILWIND_SHADES.blue[950],
  },
  background: {
    muted: "#131A2B",
    subtle: TAILWIND_SHADES.gray[800],
    DEFAULT: TAILWIND_SHADES.gray[900],
    emphasis: TAILWIND_SHADES.gray[300],
  },
  border: TAILWIND_SHADES.gray[800],
  ring: TAILWIND_SHADES.gray[800],
  content: {
    subtle: TAILWIND_SHADES.gray[600],
    DEFAULT: TAILWIND_SHADES.gray[500],
    emphasis: TAILWIND_SHADES.gray[200],
    strong: TAILWIND_SHADES.gray[50],
    inverted: TAILWIND_SHADES.gray[950],
  },
} as const;

/**
 * Tremor's categorical chart palette, in the order Tremor assigns series colours.
 * Matches `AvailableChartColors` from Tremor's chart utilities.
 */
export const TREMOR_CHART_COLOR_NAMES = [
  "blue",
  "emerald",
  "violet",
  "amber",
  "gray",
  "cyan",
  "pink",
  "lime",
  "fuchsia",
] as const;

export type TremorChartColorName = (typeof TREMOR_CHART_COLOR_NAMES)[number];

/** Hex values for the categorical chart palette, same order as the names above. */
export const TREMOR_CHART_COLORS: string[] = [
  TAILWIND_SHADES.blue[500],
  TAILWIND_SHADES.emerald[500],
  TAILWIND_SHADES.violet[500],
  TAILWIND_SHADES.amber[500],
  TAILWIND_SHADES.gray[500],
  TAILWIND_SHADES.cyan[500],
  TAILWIND_SHADES.pink[500],
  TAILWIND_SHADES.lime[500],
  TAILWIND_SHADES.fuchsia[500],
];

/** Semantic status colours used by badges, callouts and KPI deltas. */
export const TREMOR_STATUS_COLORS = {
  info: TAILWIND_SHADES.blue[500],
  success: TAILWIND_SHADES.emerald[500],
  warning: TAILWIND_SHADES.amber[500],
  error: TAILWIND_SHADES.red[500],
} as const;

/**
 * Pick a chart colour by series index, cycling through the Tremor palette.
 */
export function getTremorChartColor(index: number): string {
  const palette = TREMOR_CHART_COLORS;
  return palette[((index % palette.length) + palette.length) % palette.length];
}

/**
 * Build a colour list of `count` entries from the Tremor palette.
 */
export function getTremorChartPalette(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => getTremorChartColor(index));
}

/** Tremor tokens for the currently active colour scheme. */
export function getTremorTokens(isDark: boolean) {
  return isDark ? TREMOR_DARK : TREMOR_LIGHT;
}
