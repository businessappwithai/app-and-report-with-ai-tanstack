"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, ArrowLeft } from "lucide-react";
import type { HelpArticleRow } from "@/lib/db/kysely-db";
import { cn } from "@/lib/utils";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { id: "all", name: "All Topics", color: "bg-gray-200 dark:bg-gray-700" },
  {
    id: "getting-started",
    name: "Getting Started",
    color: "bg-blue-100 dark:bg-blue-900",
  },
  { id: "dashboard", name: "Dashboard", color: "bg-blue-100 dark:bg-blue-900" },
  { id: "sql-editor", name: "SQL Editor", color: "bg-violet-100 dark:bg-violet-900" },
  { id: "reports", name: "Reports", color: "bg-emerald-100 dark:bg-emerald-900" },
  { id: "charts", name: "Charts", color: "bg-orange-100 dark:bg-orange-900" },
  {
    id: "dashboards",
    name: "Dashboards",
    color: "bg-cyan-100 dark:bg-cyan-900",
  },
  { id: "filters", name: "Filters", color: "bg-amber-100 dark:bg-amber-900" },
  { id: "jobs", name: "Scheduled Jobs", color: "bg-emerald-100 dark:bg-emerald-900" },
  {
    id: "monitoring",
    name: "Monitoring",
    color: "bg-red-100 dark:bg-red-900",
  },
  {
    id: "nl-query",
    name: "NL Query",
    color: "bg-violet-100 dark:bg-violet-900",
  },
  {
    id: "report-generator",
    name: "Report Generator",
    color: "bg-pink-100 dark:bg-pink-900",
  },
  {
    id: "data-sources",
    name: "Data Sources",
    color: "bg-teal-100 dark:bg-teal-900",
  },
  { id: "queue", name: "Queue", color: "bg-gray-200 dark:bg-gray-700" },
  { id: "logs", name: "Logs", color: "bg-gray-200 dark:bg-gray-700" },
  { id: "users", name: "Users & Roles", color: "bg-blue-100 dark:bg-blue-900" },
  { id: "settings", name: "Settings", color: "bg-amber-100 dark:bg-amber-900" },
  {
    id: "keyboard",
    name: "Keyboard Shortcuts",
    color: "bg-blue-100 dark:bg-blue-900",
  },
];

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticleRow | null>(null);

  const { data: response } = useQuery({
    queryKey: ["help-articles", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      const res = await fetch(`/api/help/articles?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch help articles");
      const result = await res.json();
      if (!result.success) throw new Error(result.error?.message || "Failed to fetch articles");
      return result;
    },
    enabled: open,
    staleTime: Infinity,
    retry: false,
  });

  const articles = response?.data ?? [];

  const filtered = articles.filter(
    (article) => activeCategory === "all" || article.category === activeCategory
  );

  const sanitizedContent = useMemo(() => {
    if (!selectedArticle) return "";
    return DOMPurify.sanitize(selectedArticle.content);
  }, [selectedArticle]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[85vh] p-0 overflow-hidden flex flex-col">
        {selectedArticle ? (
          <>
            <DialogHeader className="border-b px-6 py-4 flex items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedArticle(null)}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="text-lg">{selectedArticle.title}</DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="help-article-content pr-4">
                <p className="text-sm text-muted-foreground mb-6">{selectedArticle.summary}</p>
                <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <div className="border-b px-6 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <DialogTitle>Help & Documentation</DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search help articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              <ScrollArea className="w-40 border-r">
                <div className="p-4 space-y-2">
                  {CATEGORIES.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={activeCategory === cat.id ? "default" : "ghost"}
                      size="sm"
                      className="w-full justify-start text-left text-xs"
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-3">
                  {filtered.length === 0 ? (
                    <p className="text-tremor-default text-tremor-content">
                      No articles found. Try a different search or category.
                    </p>
                  ) : (
                    filtered.map((article) => (
                      <button
                        key={article.id}
                        onClick={() => setSelectedArticle(article)}
                        className={cn(
                          "w-full text-left p-4 rounded-lg border transition-colors hover:bg-accent",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "h-8 w-8 rounded flex items-center justify-center flex-shrink-0",
                              `bg-${article.color}`
                            )}
                          >
                            <span className="text-xs font-bold">?</span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm leading-tight">{article.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {article.summary}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
