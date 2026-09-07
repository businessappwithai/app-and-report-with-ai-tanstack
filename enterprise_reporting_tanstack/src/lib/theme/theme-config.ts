/**
 * Tremor Design System Configuration
 *
 * Single source of truth for the design tokens used across the application,
 * mirroring the Tremor component library (https://github.com/tremorlabs/tremor-npm):
 * - Blue brand ramp on a neutral gray scale
 * - White cards on a gray-50 canvas (gray-900 on #131A2B in dark mode)
 * - Soft elevation instead of heavy borders
 * - Compact 0.375rem / 0.5rem radius scale
 *
 * The Tailwind/CSS side of these tokens lives in `src/styles/globals.css`
 * (`--tremor-*` custom properties) and `tailwind.config.ts`. Values below are
 * for JavaScript consumers that cannot read Tailwind classes — chart engines,
 * PDF/Excel exports and canvas rendering.
 */

import { TREMOR_CHART_COLORS, TREMOR_DARK, TREMOR_LIGHT } from "./tremor-colors";

export const TREMOR_THEME = {
  colors: {
    // Light Theme
    light: {
      background: TREMOR_LIGHT.background.muted, // app canvas   #F9FAFB
      foreground: TREMOR_LIGHT.content.strong, // gray-900     #111827
      card: TREMOR_LIGHT.background.DEFAULT, // white        #FFFFFF
      primary: TREMOR_LIGHT.brand.DEFAULT, // blue-500     #3B82F6
      secondary: TREMOR_LIGHT.background.subtle, // gray-100     #F3F4F6
      muted: TREMOR_LIGHT.background.subtle, // gray-100     #F3F4F6
      border: TREMOR_LIGHT.border, // gray-200     #E5E7EB
      destructive: "#EF4444", // red-500

      // Status colors
      info: "#3B82F6", // blue-500
      success: "#10B981", // emerald-500
      warning: "#F59E0B", // amber-500
      error: "#EF4444", // red-500
    },
    // Dark Theme
    dark: {
      background: TREMOR_DARK.background.muted, //              #131A2B
      foreground: TREMOR_DARK.content.strong, // gray-50      #F9FAFB
      card: TREMOR_DARK.background.DEFAULT, // gray-900     #111827
      primary: TREMOR_DARK.brand.DEFAULT, // blue-500     #3B82F6
      secondary: TREMOR_DARK.background.subtle, // gray-800     #1F2937
      muted: TREMOR_DARK.background.subtle, // gray-800     #1F2937
      border: TREMOR_DARK.border, // gray-800     #1F2937
      destructive: "#EF4444", // red-500

      // Status colors
      info: "#3B82F6",
      success: "#10B981",
      warning: "#F59E0B",
      error: "#EF4444",
    },
  },

  /** Tremor radius tokens — `rounded-tremor-small|default|full`. */
  radius: {
    none: "0px",
    small: "0.375rem", // 6px  — buttons, badges, inputs
    default: "0.5rem", // 8px  — cards, dropdowns, dialogs
    full: "9999px", // pill — progress bars, avatars
  },

  /** Tremor elevation tokens — `shadow-tremor-input|card|dropdown`. */
  shadow: {
    input: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    dropdown: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  },

  /** Tremor type scale — `text-tremor-label|default|title|metric`. */
  fontSize: {
    label: "0.75rem", // 12px — table labels, captions
    default: "0.875rem", // 14px — body copy
    title: "1.125rem", // 18px — card titles
    metric: "1.875rem", // 30px — KPI values
  },

  // Sidebar colors
  sidebar: {
    light: {
      background: TREMOR_LIGHT.background.DEFAULT,
      foreground: TREMOR_LIGHT.content.DEFAULT,
      primary: TREMOR_LIGHT.brand.faint,
      border: TREMOR_LIGHT.border,
      ring: TREMOR_LIGHT.brand.muted,
    },
    dark: {
      background: TREMOR_DARK.background.DEFAULT,
      foreground: TREMOR_DARK.content.DEFAULT,
      primary: TREMOR_DARK.brand.faint,
      border: TREMOR_DARK.border,
      ring: TREMOR_DARK.brand.muted,
    },
  },

  /** Categorical chart palette, in Tremor's series assignment order. */
  chart: {
    1: TREMOR_CHART_COLORS[0], // blue-500
    2: TREMOR_CHART_COLORS[1], // emerald-500
    3: TREMOR_CHART_COLORS[2], // violet-500
    4: TREMOR_CHART_COLORS[3], // amber-500
    5: TREMOR_CHART_COLORS[4], // gray-500
    6: TREMOR_CHART_COLORS[5], // cyan-500
    7: TREMOR_CHART_COLORS[6], // pink-500
    8: TREMOR_CHART_COLORS[7], // lime-500
    9: TREMOR_CHART_COLORS[8], // fuchsia-500
  },
} as const;

// Theme configuration for next-themes
export const THEME_CONFIG = {
  attribute: "class",
  defaultTheme: "system",
  enableSystem: true,
  enableColorScheme: false,
  themes: ["light", "dark"],
  forcedTheme: undefined,
  storageKey: "theme-preference",
  disableTransitionOnChange: true,
} as const;
