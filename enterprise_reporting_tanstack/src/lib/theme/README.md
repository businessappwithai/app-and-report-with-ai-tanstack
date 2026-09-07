# Tremor Design Theme System

Theme provider for the Enterprise Reporting System, implementing the
[Tremor](https://github.com/tremorlabs/tremor-npm) design system.

See `docs/TREMOR_DESIGN_SYSTEM.md` for the token reference and component catalogue.

## Features

- **Light & Dark Themes**: Full light and dark mode support with system preference detection
- **SSR Optimized**: Prevents flash of unstyled content (FOUC) with inline initialization script
- **Tremor Design System**: Blue brand ramp on a neutral gray scale, soft elevation, compact radii
- **Persistent Storage**: User theme preference saved to localStorage
- **Smooth Transitions**: Configurable transition on theme change
- **Type-Safe**: Full TypeScript support with theme types

## Architecture

### Components

#### `ThemeProvider`
Main theme provider component that wraps the application. Based on `next-themes` for reliable SSR support.

```tsx
import { ThemeProvider } from '@/lib/theme/theme-provider';

export default function App() {
  return (
    <ThemeProvider>
      <YourApp />
    </ThemeProvider>
  );
}
```

#### `ThemeScript`
Runs theme initialization before first paint to prevent FOUC. Should be placed in `<head>`.

```tsx
import { ThemeScript } from '@/lib/theme/theme-script';

export default function RootLayout() {
  return (
    <html>
      <head>
        <ThemeScript />
      </head>
      <body>...</body>
    </html>
  );
}
```

#### `ThemeSelector`
UI component for theme switching with light/dark/system options.

```tsx
import { ThemeSelector } from '@/components/theme/theme-selector';

export default function Header() {
  return <ThemeSelector />;
}
```

### Hooks

#### `useTheme()`
Access and control theme state.

```tsx
import { useTheme } from '@/lib/theme/use-theme';

export default function Component() {
  const { theme, setTheme, systemTheme } = useTheme();

  return (
    <button onClick={() => setTheme('dark')}>
      Current: {theme} (System: {systemTheme})
    </button>
  );
}
```

## Configuration

Theme configuration defined in `src/lib/theme/theme-config.ts`:

```typescript
export const THEME_CONFIG = {
  attribute: "class",           // Apply theme to class attribute
  defaultTheme: "system",       // Default to system preference
  enableSystem: true,           // Enable system preference detection
  enableColorScheme: false,     // Don't use color-scheme meta
  themes: ["light", "dark"],    // Available themes
  storageKey: "theme-preference", // localStorage key
  disableTransitionOnChange: true, // No transition animation
};
```

## Tremor Colors

### Light Theme
- **Canvas**: #F9FAFB (gray-50) — the page background
- **Card**: #FFFFFF (white) — surfaces sit above the canvas
- **Content**: #111827 strong / #374151 emphasis / #6B7280 default (gray-900/700/500)
- **Brand**: #3B82F6 (blue-500), #1D4ED8 on hover (blue-700)
- **Borders**: #E5E7EB (gray-200)

### Dark Theme
- **Canvas**: #131A2B — the page background
- **Card**: #111827 (gray-900)
- **Content**: #F9FAFB strong / #E5E7EB emphasis / #6B7280 default
- **Brand**: #3B82F6 (blue-500), #60A5FA on hover (blue-400)
- **Borders**: #1F2937 (gray-800)

## CSS Variables

Tokens are defined as `--tremor-*` custom properties in `src/styles/globals.css`
and re-exported through the semantic aliases the component tree already uses:

```css
:root {
  --tremor-brand: 217 91% 60%;          /* blue-500  */
  --tremor-background: 0 0% 100%;       /* white     */
  --tremor-background-muted: 210 20% 98%; /* gray-50 */
  --tremor-border: 220 13% 91%;         /* gray-200  */
  --tremor-content-strong: 221 39% 11%; /* gray-900  */

  /* semantic aliases point at the same values */
  --background: var(--tremor-background-muted);
  --card: var(--tremor-background);
  --primary: var(--tremor-brand);
}

.dark {
  /* the same token names, redefined for dark mode */
  --tremor-background: 221 39% 11%;     /* gray-900 */
  --tremor-border: 215 28% 17%;         /* gray-800 */
}
```

Because the variables swap under `.dark`, `bg-tremor-background` is correct in
both themes without a `dark:` variant. Tremor's own `dark:bg-dark-tremor-*`
class names are also registered, so markup copied from the Tremor docs works
unchanged.

## Usage in Components

### Preferred: Tremor tokens
```tsx
<div className="rounded-tremor-default bg-tremor-background p-6 shadow-tremor-card ring-1 ring-tremor-ring">
  <p className="text-tremor-default text-tremor-content">Reports run</p>
  <p className="text-tremor-metric font-semibold text-tremor-content-strong">12,480</p>
</div>
```

### Also valid: semantic aliases
```tsx
<div className="bg-card text-foreground">
  <button className="bg-primary text-primary-foreground">Click me</button>
</div>
```

Note: `cn()` in `src/lib/utils.ts` registers the Tremor font-size, radius and
shadow scales with `tailwind-merge`. Without that registration `tailwind-merge`
would read `text-tremor-metric` as a colour class and drop it — do not swap `cn`
for a plain `twMerge`.

## Implementation Details

### How It Works

1. **Page Load**:
   - `ThemeScript` runs in head before rendering
   - Checks `localStorage` for stored preference
   - Falls back to system preference via `prefers-color-scheme`
   - Applies theme class to `<html>` element immediately

2. **Theme Switching**:
   - `useTheme()` hook provides `setTheme()` function
   - User selects new theme via `ThemeSelector`
   - Preference saved to `localStorage`
   - `ThemeProvider` updates class on `<html>`

3. **System Preference Changes**:
   - Script listens for `prefers-color-scheme` changes
   - If no explicit preference set, applies system preference
   - Automatic theme update without page reload

### SSR Safety

- `suppressHydrationWarning` prevents hydration warnings
- Inline script runs before React hydration
- No async loading or component state dependencies
- Works with TanStack Start and other SSR frameworks

## Customization

### Add Custom Themes

Modify `src/styles/globals.css`:

```css
@layer base {
  :root {
    /* Light theme */
  }

  .dark {
    /* Dark theme */
  }

  .brand-theme {
    /* Override the --tremor-* tokens for a custom brand */
  }
}
```

### Change Default Theme

Edit `src/lib/theme/theme-config.ts`:

```typescript
export const THEME_CONFIG = {
  defaultTheme: "dark", // Change to 'dark' or 'system'
  // ... other config
};
```

### Disable System Preference

```typescript
export const THEME_CONFIG = {
  enableSystem: false,   // Ignore system preference
  defaultTheme: "light", // Use specified default
};
```

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 13+)
- No IE support (uses `localStorage` and CSS custom properties)

## Performance

- **FOUC Prevention**: Inline script executes before first paint
- **Minimal Re-renders**: Single context update on theme change
- **Lazy Loading**: Theme script only loaded in head
- **No External Requests**: Uses `prefers-color-scheme` media query

## Troubleshooting

### Theme Not Persisting
Check browser's localStorage is enabled and not cleared on page close.

### FOUC on Page Load
Ensure `ThemeScript` is rendered in `<head>` before other scripts.

### Hydration Warnings
Add `suppressHydrationWarning` to affected elements and the script tag.

### Theme Not Switching
Verify `ThemeProvider` wraps the component tree and `useTheme()` is called within provider.

## References

- [next-themes Documentation](https://github.com/pacocoursey/next-themes)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [Prefers Color Scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
