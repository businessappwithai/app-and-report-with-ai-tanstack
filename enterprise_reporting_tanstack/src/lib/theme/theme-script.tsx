/**
 * Theme initialization script that runs before first paint
 * Prevents flash of unstyled content (FOUC) on page load
 *
 * This uses dangerouslySetInnerHTML with hardcoded trusted script
 * to prevent FOUC - security is ensured as the script is not user-controlled
 */
export function ThemeScript() {
  const themeScript = `(function() {
    function getTheme() {
      const stored = localStorage.getItem('theme-preference');
      if (stored) return stored;

      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    }

    function applyTheme(theme) {
      const html = document.documentElement;
      html.classList.remove('light', 'dark');
      html.classList.add(theme);
      html.setAttribute('data-theme', theme);
    }

    const theme = getTheme();
    applyTheme(theme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      if (!localStorage.getItem('theme-preference')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  })();`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      suppressHydrationWarning
    />
  );
}
