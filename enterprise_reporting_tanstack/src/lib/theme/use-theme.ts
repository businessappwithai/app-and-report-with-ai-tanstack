/**
 * Hook to use the theme context
 * Provides access to current theme and theme switching function
 *
 * Example:
 * const { theme, setTheme, systemTheme } = useTheme();
 * setTheme('dark'); // 'light' | 'dark' | 'system'
 */

import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  return useNextTheme();
}

export type Theme = "light" | "dark" | "system";
