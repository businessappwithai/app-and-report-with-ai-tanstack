# APPWITHAI Design System

**Version:** 1.0  
**Last Updated:** 2026-04-25  
**Maintained by:** Design & Frontend Team

---

## Color Palette

### Primary
- **Primary Orange:** `#FF8400` — Primary actions, highlights, brand accent
- **Primary Muted:** `rgba(255, 132, 0, 0.1)` — Light backgrounds for primary elements

### Semantic
- **Success Green:** `#10b981` — Successful states, completed steps, running deployments
- **Success Light:** `rgba(16, 185, 129, 0.2)` — Light backgrounds for success states
- **Error Red:** `#ef4444` — Errors, destructive actions, failed states
- **Error Light:** `rgba(239, 68, 68, 0.1)` — Light backgrounds for error states
- **Warning Amber:** `#f59e0b` — Warnings, incomplete states
- **Warning Light:** `rgba(245, 158, 11, 0.1)` — Light backgrounds for warning states
- **Info Blue:** `#3b82f6` — Informational content, neutral highlights
- **Info Light:** `rgba(59, 130, 246, 0.1)` — Light backgrounds for info states

### Neutral (Dark Theme)
- **Background:** `hsl(var(--background))` — Primary page background
- **Foreground:** `hsl(var(--foreground))` — Primary text color
- **Card:** `hsl(var(--card))` — Card background
- **Muted:** `hsl(var(--muted))` — Muted text, disabled states
- **Muted Foreground:** `hsl(var(--muted-foreground))` — Muted text color
- **Border:** `hsl(var(--border))` — Border color for cards, inputs, dividers

---

## Typography

### Font Family
- **Display/Headings:** System default (SF Pro Display, -apple-system, Segoe UI)
- **Body/UI:** Söhne or system default (clean, readable sans-serif)
- **Monospace:** Fira Code or system monospace (for code blocks, entity names)

### Sizes & Weights

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| h1 | 28px | 700 (bold) | Page titles, hero headings |
| h2 | 24px | 700 (bold) | Section headings, step titles |
| h3 | 20px | 600 (semibold) | Subsection headings, card titles |
| body-lg | 16px | 400 (regular) | Main body text, descriptions |
| body | 14px | 400 (regular) | Form labels, secondary text |
| body-sm | 12px | 400 (regular) | Captions, timestamps, hints |
| button | 14px | 600 (semibold) | All button text |
| code | 13px | 400 (regular) | Code blocks, entity names |

### Line Height
- Headings: 1.2 (tight, impactful)
- Body text: 1.6 (readable, comfortable)
- Code: 1.5

---

## Spacing Scale (4px Grid)

All spacing uses multiples of 4px for consistency.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight gaps, icon spacing |
| sm | 8px | Small gaps, padding inside badges |
| md | 12px | Default padding, gaps between elements |
| lg | 16px | Card padding, section spacing |
| xl | 24px | Large gaps, section headers |
| 2xl | 32px | Page-level spacing |
| 3xl | 48px | Major section breaks |

---

## Components

### Buttons

**Primary Button**
```
Background: #FF8400
Text: White (#FFFFFF)
Padding: 10px 16px (height 40px minimum)
Border Radius: 8px
Font: 14px, 600 weight (semibold)
Hover: bg-primary/90 (darken slightly)
Active: bg-primary/80 (more emphasis)
Disabled: opacity-50, cursor-not-allowed
```

**Secondary Button**
```
Background: hsl(var(--muted))
Text: hsl(var(--foreground))
Padding: 10px 16px
Border Radius: 8px
Font: 14px, 600 weight
Hover: bg-muted/80
```

**Destructive Button**
```
Background: #ef4444 (red)
Text: White
Padding: 10px 16px
Border Radius: 8px
Hover: bg-red-600
```

**Ghost/Text Button**
```
Background: transparent
Text: hsl(var(--foreground))
Padding: 10px 16px
Border Radius: 8px
Hover: bg-muted/50
```

### Form Inputs

**Text Input / Textarea**
```
Background: hsl(var(--muted))
Border: 1px solid hsl(var(--border))
Padding: 10px 12px
Border Radius: 8px
Font: 14px
Focus: ring-2 ring-primary/50, border-primary
Placeholder: text-muted-foreground, 50% opacity
```

**Select / Dropdown**
```
Background: hsl(var(--background))
Border: 1px solid hsl(var(--border))
Padding: 10px 12px
Border Radius: 8px
Font: 14px
Focus: ring-2 ring-primary/50, border-primary
```

**Checkbox / Radio**
```
Size: 20px × 20px
Border: 2px solid hsl(var(--border))
Border Radius: 4px (checkbox) or 50% (radio)
Checked: bg-primary, border-primary
Focus: ring-2 ring-primary/50
```

### Cards

**Standard Card**
```
Background: hsl(var(--card))
Border: 1px solid hsl(var(--border))
Border Radius: 12px
Padding: 16px (lg spacing)
Shadow: none (clean design)
Hover: border-primary/50, transition-all 200ms
```

**Status Badge**
```
Background: semantic color (success green, error red, warning amber, info blue)
Text: semantic color (lighter/brighter variant)
Padding: 4px 8px (xs/sm)
Border Radius: 20px (pill shape)
Font: 12px, 600 weight
Border: 1px solid semantic color with transparency
```

### Progress Stepper

**Step Circle**
```
Completed: bg-emerald-500/20, text-emerald-400, border-emerald-500/50
Current: bg-primary, text-white, ring-4 ring-primary/20
Pending: bg-muted, text-muted-foreground, border-border
Size: 32px diameter, 8px font (step number)
Hover (clickable): scale-110, cursor-pointer
```

**Connecting Line**
```
Color: hsl(var(--border))
Height: 2px
Completed line: #10b981
```

### Loading States

**Spinner**
```
Size: 24px or 32px (context-dependent)
Color: primary (#FF8400)
Animation: spin (1s duration, linear, infinite)
```

**Skeleton**
```
Background: hsl(var(--muted))
Height: match expected content (e.g., 20px for text line)
Border Radius: 4px
Animation: pulse 2s ease-in-out infinite
```

---

## Interactions & Animations

### Transitions
- **Default:** 200ms ease-out (button hover, color changes)
- **Fast:** 100ms ease-out (small interactions, opacity)
- **Slow:** 300ms ease-in-out (modals opening, major layout shifts)

### Hover States
- Buttons: darken/lighten by 10%, scale optional
- Cards: border-primary/50, shadow-md
- Links: underline, color-primary

### Focus States
- Ring: 2px solid primary color, 4px offset
- All interactive elements must have visible focus ring

### Disabled States
- Opacity: 50%
- Cursor: not-allowed
- No hover effects

---

## Dark Mode

All colors use CSS variables that adapt to dark mode:
```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3%;
  --card: 0 0% 96%;
  --muted: 0 0% 89%;
  --border: 0 0% 89%;
  /* ... */
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 0 0% 3%;
    --foreground: 0 0% 98%;
    --card: 0 0% 10%;
    --muted: 0 0% 14%;
    --border: 0 0% 20%;
    /* ... */
  }
}
```

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| sm | 640px | Small phones |
| md | 768px | Tablets |
| lg | 1024px | Large tablets / small desktops |
| xl | 1280px | Desktops |
| 2xl | 1536px | Large desktops |

**Design Priority:** Desktop-first (mobile optimization deferred)

---

## Spacing in Layouts

### Page/Container
- Max width: 1280px (lg)
- Horizontal padding: 16px (lg spacing) on smaller screens, 32px (2xl) on desktop
- Vertical padding: 24px (xl) between sections

### Cards Grid
- Column gap: 24px (xl)
- Row gap: 24px (xl)
- Responsive: 1 col (mobile), 2 col (tablet), 3 col (desktop)

### Forms
- Field spacing (vertical): 16px (lg)
- Label to input: 8px (sm)
- Section spacing: 32px (2xl)

---

## Accessibility

### Color Contrast
- Body text: 4.5:1 contrast minimum (WCAG AA)
- Headings: 3:1 contrast minimum
- UI components: 3:1 contrast
- Status indicators: never rely on color alone (use text/icons too)

### Focus Indicators
- All interactive elements must have visible focus ring
- Focus ring: 2px solid primary color, 4px offset

### Motion
- Animations must respect prefers-reduced-motion
- Spinners/loading states must be accompanied by text ("Loading...")

### Touch Targets
- Minimum size: 44px × 44px (mobile) — deferred for now
- Desktop: 40px minimum height for buttons

---

## Usage

### When Adding New Components
1. Check if it matches an existing pattern (button type, card style, etc.)
2. If new: follow spacing scale (4px grid), color palette, and typography rules
3. Add to this doc for future reference
4. Test focus states and accessibility

### When Modifying Existing Components
1. Ensure changes align with this design system
2. Update the relevant section in this doc
3. Test for consistency across all pages

### Tools
- **Color Picker:** Use hex values exactly as listed (#FF8400, #10b981, etc.)
- **Typography:** Match font sizes and weights to this spec
- **Spacing:** Use TailwindCSS spacing utilities (px-4, py-6, gap-4, etc.) based on our scale

---

## Brand Values

- **Clarity:** Every design decision should reduce ambiguity
- **Trust:** Show results, explain reasoning, celebrate outcomes
- **Simplicity:** Remove decisions users don't need to make
- **Precision:** Use exact measurements, not approximations
- **Accessibility:** Inclusive by default, not by afterthought
