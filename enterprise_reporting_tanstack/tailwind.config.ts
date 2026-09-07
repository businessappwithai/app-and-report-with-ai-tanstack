import type { Config } from 'tailwindcss';

/**
 * Tailwind theme for the Tremor design system.
 *
 * Two token layers live side by side:
 *
 * 1. `tremor-*` / `dark-tremor-*` — the native Tremor namespace, identical to
 *    the preset published with https://github.com/tremorlabs/tremor-npm. Use
 *    these directly when writing new UI (`bg-tremor-background`,
 *    `text-tremor-content-emphasis`, `rounded-tremor-default`, …).
 * 2. The semantic shadcn aliases (`background`, `card`, `primary`, `muted`, …)
 *    which are wired in `src/styles/globals.css` to the *same* Tremor values,
 *    so the existing component tree inherits the Tremor look automatically and
 *    dark mode keeps working through the `.dark` class.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './src/routes/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/server-fns/**/*.{js,ts,jsx,tsx,mdx}',
    './src/hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // ── Tremor design system tokens (light) ──────────────────────────────
        tremor: {
          brand: {
            faint: 'hsl(var(--tremor-brand-faint) / <alpha-value>)',
            muted: 'hsl(var(--tremor-brand-muted) / <alpha-value>)',
            subtle: 'hsl(var(--tremor-brand-subtle) / <alpha-value>)',
            DEFAULT: 'hsl(var(--tremor-brand) / <alpha-value>)',
            emphasis: 'hsl(var(--tremor-brand-emphasis) / <alpha-value>)',
            inverted: 'hsl(var(--tremor-brand-inverted) / <alpha-value>)',
          },
          background: {
            muted: 'hsl(var(--tremor-background-muted) / <alpha-value>)',
            subtle: 'hsl(var(--tremor-background-subtle) / <alpha-value>)',
            DEFAULT: 'hsl(var(--tremor-background) / <alpha-value>)',
            emphasis: 'hsl(var(--tremor-background-emphasis) / <alpha-value>)',
          },
          border: {
            DEFAULT: 'hsl(var(--tremor-border) / <alpha-value>)',
          },
          ring: {
            DEFAULT: 'hsl(var(--tremor-ring) / <alpha-value>)',
          },
          content: {
            subtle: 'hsl(var(--tremor-content-subtle) / <alpha-value>)',
            DEFAULT: 'hsl(var(--tremor-content) / <alpha-value>)',
            emphasis: 'hsl(var(--tremor-content-emphasis) / <alpha-value>)',
            strong: 'hsl(var(--tremor-content-strong) / <alpha-value>)',
            inverted: 'hsl(var(--tremor-content-inverted) / <alpha-value>)',
          },
        },
        // ── Tremor dark-mode namespace ───────────────────────────────────────
        // The `--tremor-*` variables are already redefined under `.dark`, so
        // these aliases resolve to the dark palette wherever Tremor's own
        // `dark:*-dark-tremor-*` class names are used. That keeps markup copied
        // straight out of the Tremor docs working without edits, while new code
        // can use the shorter, variable-driven `tremor-*` classes on their own.
        'dark-tremor': {
          brand: {
            faint: 'hsl(var(--tremor-brand-faint) / <alpha-value>)',
            muted: 'hsl(var(--tremor-brand-muted) / <alpha-value>)',
            subtle: 'hsl(var(--tremor-brand-subtle) / <alpha-value>)',
            DEFAULT: 'hsl(var(--tremor-brand) / <alpha-value>)',
            emphasis: 'hsl(var(--tremor-brand-emphasis) / <alpha-value>)',
            inverted: 'hsl(var(--tremor-brand-inverted) / <alpha-value>)',
          },
          background: {
            muted: 'hsl(var(--tremor-background-muted) / <alpha-value>)',
            subtle: 'hsl(var(--tremor-background-subtle) / <alpha-value>)',
            DEFAULT: 'hsl(var(--tremor-background) / <alpha-value>)',
            emphasis: 'hsl(var(--tremor-background-emphasis) / <alpha-value>)',
          },
          border: {
            DEFAULT: 'hsl(var(--tremor-border) / <alpha-value>)',
          },
          ring: {
            DEFAULT: 'hsl(var(--tremor-ring) / <alpha-value>)',
          },
          content: {
            subtle: 'hsl(var(--tremor-content-subtle) / <alpha-value>)',
            DEFAULT: 'hsl(var(--tremor-content) / <alpha-value>)',
            emphasis: 'hsl(var(--tremor-content-emphasis) / <alpha-value>)',
            strong: 'hsl(var(--tremor-content-strong) / <alpha-value>)',
            inverted: 'hsl(var(--tremor-content-inverted) / <alpha-value>)',
          },
        },
        // ── Semantic aliases consumed by the existing component tree ─────────
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
          '6': 'hsl(var(--chart-6))',
          '7': 'hsl(var(--chart-7))',
          '8': 'hsl(var(--chart-8))',
          '9': 'hsl(var(--chart-9))',
        },
        // Status colors
        info: {
          DEFAULT: 'hsl(var(--color-info))',
          foreground: 'hsl(var(--color-info-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--color-success))',
          foreground: 'hsl(var(--color-success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--color-warning))',
          foreground: 'hsl(var(--color-warning-foreground))',
        },
        error: {
          DEFAULT: 'hsl(var(--color-error))',
          foreground: 'hsl(var(--color-error-foreground))',
        },
      },
      boxShadow: {
        // Tremor elevation scale
        'tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'dark-tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'dark-tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'dark-tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      borderRadius: {
        'tremor-small': '0.375rem',
        'tremor-default': '0.5rem',
        'tremor-full': '9999px',
        // Semantic aliases mapped onto the Tremor radius scale
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      fontSize: {
        'tremor-label': ['0.75rem', { lineHeight: '1rem' }],
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title': ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric': ['1.875rem', { lineHeight: '2.25rem' }],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  // Tremor colours chosen at runtime (chart series, badge/callout colours) are
  // not statically analysable, so the palette shades they use are safelisted.
  safelist: [
    {
      pattern:
        /^(bg|text|border|ring|stroke|fill)-(blue|emerald|violet|amber|gray|cyan|pink|lime|fuchsia|red|orange|yellow|green|teal|sky|indigo|purple|rose|slate|zinc|neutral|stone)-(50|100|200|300|400|500|600|700|800|900|950)$/,
      variants: ['hover', 'dark', 'data-[selected]'],
    },
  ],
  plugins: [require('tailwindcss-animate')],
};

export default config;
