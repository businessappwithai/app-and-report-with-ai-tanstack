import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DuckDBProvider } from "@/components/duckdb/DuckDBProvider";
import { ErrorBoundary } from "@/components/errors/error-boundary";
import { Toaster } from "@/components/ui/sonner";
import { TanStackDBWrapper } from "@/lib/tanstack-db/provider";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { ThemeScript } from "@/lib/theme/theme-script";
import "@/styles/globals.css";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light dark" },
      { title: "Enterprise Reporting System" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-tremor-content">Page not found</p>
      </div>
    </div>
  ),
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <ErrorBoundary>
          <ThemeProvider>
            <TanStackDBWrapper>
              <DuckDBProvider>
                <TooltipProvider>
                  <QueryClientProvider client={queryClient}>
                    <Outlet />
                    <Toaster />
                    <ReactQueryDevtools initialIsOpen={false} />
                  </QueryClientProvider>
                </TooltipProvider>
              </DuckDBProvider>
            </TanStackDBWrapper>
          </ThemeProvider>
        </ErrorBoundary>
        <Scripts />
      </body>
    </html>
  );
}
