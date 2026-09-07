"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/lib/theme/use-theme";

/**
 * Theme Selector Component
 * Switches between light, dark and system themes.
 *
 * "System" is a real option here: the provider runs with `enableSystem`, so an
 * unset preference follows `prefers-color-scheme`. Bind to `theme` (the stored
 * preference) rather than `resolvedTheme`, or picking "System" would immediately
 * display as Light or Dark instead.
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <Select value={theme ?? "system"} onValueChange={setTheme}>
      <SelectTrigger className="w-48" aria-label="Theme">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <span>Light Theme</span>
          </div>
        </SelectItem>
        <SelectItem value="dark">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            <span>Dark Theme</span>
          </div>
        </SelectItem>
        <SelectItem value="system">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            <span>System</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
