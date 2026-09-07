# Tremor Design System

The application's UI implements the [Tremor](https://github.com/tremorlabs/tremor-npm)
design system. This document is the reference for its tokens and components.

A live version of everything below renders at **Settings → Design System**
(`/settings/design-system`).

## Why tokens, not the `@tremor/react` package

Tremor's design language is applied natively — as a Tailwind token layer plus
components built on Radix, CVA and `tailwind-merge` — rather than by installing
`@tremor/react`. Three reasons:

1. **React version.** `@tremor/react@3.18.7` (last published Jan 2025) declares
   `peerDependencies: { react: "^18.0.0" }`. This application runs React 19.
2. **Coverage.** The package would only style components written against its own
   API. The ~160 existing components in `src/` would keep the old look, so the
   token layer is needed regardless to make the change app-wide.
3. **Duplication.** The package bundles its own Headless UI, Recharts and
   `tailwind-merge`, alongside the Radix + Recharts already in use — two overlay
   and focus-management systems in one bundle.

The token values are copied verbatim from Tremor's published Tailwind preset, so
markup from the Tremor docs renders correctly here. If the package later ships a
React 19 release, it can be added alongside this layer without a re-theme.

## Tokens

### Colour

Tokens are CSS custom properties in `src/styles/globals.css`, exposed as Tailwind
utilities via the `tremor` namespace in `tailwind.config.ts`. They are redefined
under `.dark`, so **a `dark:` variant is not needed** for token-based classes.

| Utility                          | Light            | Dark             | Use                        |
|----------------------------------|------------------|------------------|----------------------------|
| `bg-tremor-background`           | white            | gray-900         | Cards, dropdowns, dialogs  |
| `bg-tremor-background-muted`     | gray-50          | `#131A2B`        | App canvas, table hover    |
| `bg-tremor-background-subtle`    | gray-100         | gray-800         | Inert fills, skeletons     |
| `bg-tremor-brand`                | blue-500         | blue-500         | Primary actions            |
| `bg-tremor-brand-faint`          | blue-50          | `#0B1229`        | Active nav, badges         |
| `bg-tremor-brand-emphasis`       | blue-700         | blue-400         | Primary hover              |
| `border-tremor-border`           | gray-200         | gray-800         | Rules and dividers         |
| `ring-tremor-ring`               | gray-200         | gray-800         | Card rings                 |
| `text-tremor-content`            | gray-500         | gray-500         | Body copy, labels          |
| `text-tremor-content-emphasis`   | gray-700         | gray-200         | Input text, values         |
| `text-tremor-content-strong`     | gray-900         | gray-50          | Headings, metrics          |
| `text-tremor-content-subtle`     | gray-400         | gray-600         | Icons, placeholders        |

The semantic aliases used by the pre-existing component tree (`bg-card`,
`text-foreground`, `bg-primary`, `border-border`, …) point at the same values, so
untouched components inherited the Tremor look automatically.

### Type scale

Four sizes carry the whole product; hierarchy comes from colour, not size jumps.

| Utility               | Size            | Use                        |
|-----------------------|-----------------|----------------------------|
| `text-tremor-label`   | 12px / 16px     | Axis ticks, captions       |
| `text-tremor-default` | 14px / 20px     | Body copy (the body default) |
| `text-tremor-title`   | 18px / 28px     | Card and section titles    |
| `text-tremor-metric`  | 30px / 36px     | KPI values                 |

### Radius and elevation

| Utility                    | Value                        | Use                       |
|----------------------------|------------------------------|---------------------------|
| `rounded-tremor-small`     | 6px                          | Badges, menu items, chips |
| `rounded-tremor-default`   | 8px                          | Cards, inputs, buttons    |
| `rounded-tremor-full`      | pill                         | Progress bars, avatars    |
| `shadow-tremor-input`      | 1px subtle                   | Inputs, buttons           |
| `shadow-tremor-card`       | 3px soft                     | Cards                     |
| `shadow-tremor-dropdown`   | 6px lifted                   | Menus, dialogs, tooltips  |

### Chart palette

Series colours follow Tremor's categorical order:

`blue-500 → emerald-500 → violet-500 → amber-500 → gray-500 → cyan-500 →
pink-500 → lime-500 → fuchsia-500`

Consume it from `src/lib/theme/tremor-colors.ts` rather than hardcoding hex:

```ts
import { getTremorChartColor, getTremorChartPalette } from "@/lib/theme/tremor-colors";

getTremorChartColor(0);      // "#3b82f6" — cycles past the end of the palette
getTremorChartPalette(4);    // first four series colours
```

The same palette is exposed to CSS as `--chart-1` … `--chart-9`.

## Components

### Restyled in place

These keep their existing APIs, so no call sites changed:

`Card` · `Button` · `Badge` · `Input` · `Textarea` · `Select` · `Checkbox` ·
`Switch` · `Label` · `Table` · `Tabs` · `Alert` · `Dialog` · `DropdownMenu` ·
`Popover` · `Tooltip` · `Command` · `MultiSelect` · `Separator` · `Skeleton` ·
`Avatar` · `ScrollArea` · `Resizable` · `Sonner` (toasts)

Additions worth knowing about:

- `Card` takes `decoration="top|bottom|left|right"` and `decorationColor` for
  Tremor's accent stripe.
- `Button` gains a `light` variant (borderless brand text button) and `xs` size.
- `Badge` gains `info`, `error` and `neutral` variants plus a `size` prop.
- `TabsList` takes `variant="line"` (default, underlined) or `variant="solid"`
  (segmented control). Triggers pick the variant up through context.

### New Tremor components

| Component | File | Purpose |
|-----------|------|---------|
| `Metric` `Title` `Subtitle` `Text` `TextLabel` | `ui/typography.tsx` | The Tremor type scale as components |
| `KpiCard` `BadgeDelta` `toDeltaType` | `ui/kpi-card.tsx` | KPI tile with directional delta badge |
| `Callout` | `ui/callout.tsx` | Tinted panel with accent stripe |
| `Divider` | `ui/divider.tsx` | Full-width rule, optional centred label |
| `ProgressBar` `ProgressCircle` | `ui/progress-bar.tsx` | Brand-filled progress indicators |
| `BarList` | `ui/bar-list.tsx` | Ranked horizontal breakdown, no axis |
| `Tracker` | `ui/tracker.tsx` | Uptime / run-history block row |
| `Legend` | `ui/legend.tsx` | Chart legend with palette dots |

```tsx
<KpiCard label="Reports run" value="12,480" delta="+12.3%" deltaType="increase" />
<KpiCard label="Storage used" value="68%" description="of 2 TB quota" progress={68} />
```

## Charts

Both chart engines are themed to render identically.

**ECharts** (`src/components/echarts/ThemeAdapter.tsx`) — the default engine.
`getBaseEChartsOption(isDark)` hides axis rules and tick marks, draws horizontal
grid lines only, sets 12px grey tick labels, and styles tooltips as a Tremor
dropdown surface. Colours resolve to hex because ECharts paints to canvas and
cannot read CSS custom properties.

**Recharts** (`src/components/charts/tremor-chart-theme.tsx`) — spread the prop
bundles onto any Recharts chart:

```tsx
import {
  TremorChartLegend, TremorChartTooltip, tremorAreaProps, tremorBarProps,
  tremorCursorProps, tremorGridProps, tremorLineProps,
  tremorXAxisProps, tremorYAxisProps,
} from "@/components/charts/tremor-chart-theme";

<LineChart data={data}>
  <CartesianGrid {...tremorGridProps} />
  <XAxis dataKey="date" {...tremorXAxisProps} />
  <YAxis {...tremorYAxisProps} />
  <Tooltip content={<TremorChartTooltip />} cursor={tremorCursorProps} />
  <Legend content={<TremorChartLegend />} />
  <Line dataKey="revenue" stroke={getTremorChartColor(0)} {...tremorLineProps} />
</LineChart>
```

## Conventions

1. **Prefer `tremor-*` utilities in new code.** The semantic aliases remain valid,
   but the Tremor names state intent (`text-tremor-content` vs `text-muted-foreground`).
2. **No `dark:` variants for tokens.** The variables already swap under `.dark`.
   Use `dark:` only for raw palette colours, e.g. `text-red-700 dark:text-red-400`.
3. **Cards carry `ring-1`, not `border`.** Tremor separates surfaces with a ring
   plus soft shadow.
4. **Status colours are tinted, not solid.** 10% fill, 20% inset ring, 700-shade
   text — see `Badge` and `Callout`.
5. **Use `cn()` from `src/lib/utils.ts`.** It registers the Tremor scales with
   `tailwind-merge`; a plain `twMerge` silently drops `text-tremor-metric` and
   friends by mistaking them for colour classes.
6. **Take chart colours from `tremor-colors.ts`.** Never hardcode series hex values.
