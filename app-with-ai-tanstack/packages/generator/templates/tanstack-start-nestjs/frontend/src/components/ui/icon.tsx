
/**
 * Dynamic Icon Component
 *
 * Renders lucide-react icons dynamically by name.
 * Supports icon names like 'User', 'Calendar', 'FileText', etc.
 *
 * Auto-generated component
 */

import * as LucideIcons from "lucide-react";
import type { HTMLAttributes } from "react";

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: number;
  className?: string;
}

const ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string; size?: number }>
> = LucideIcons as unknown as Record<
  string,
  React.ComponentType<{ className?: string; size?: number }>
>;

/**
 * Renders an icon from lucide-react by name
 * Falls back to a default icon if name is not found
 */
export function Icon({ name, size = 16, className, ...props }: IconProps) {
  const IconComponent = ICON_MAP[name];

  if (!IconComponent) {
    // Fallback to a default icon if name is not found
    return (
      <span
        className={className}
        {...props}
        style={{
          fontSize: `${size}px`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        📊
      </span>
    );
  }

  return <IconComponent size={size} className={className} {...props} />;
}

/**
 * Get all available icon names
 * Useful for autocomplete in form fields
 */
export function getAvailableIconNames(): string[] {
  return Object.keys(ICON_MAP);
}
