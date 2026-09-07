import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  AlertCircle,
  Download,
  FileCode2,
  Filter,
  GitBranch,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { requestContext } from "@/lib/request-context";
import type { MermaidFile } from "@/types/project";

async function checkAuthMe() {
  const { baseUrl, fetchInit } = await requestContext();
  const res = await fetch(`${baseUrl}/api/auth/me`, fetchInit);
  return res.json() as Promise<{ user: { id: string; email: string; role: string } | null }>;
}

export const Route = createFileRoute("/admin/mermaid/")({
  beforeLoad: async () => {
    try {
      const data = await checkAuthMe();
      if (!data.user) throw redirect({ to: "/login" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: MermaidLibraryPage,
});

function MermaidLibraryPage() {
  const [files, setFiles] = useState<MermaidFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"" | "erd" | "rules">("");
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/mermaid?${params}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [typeFilter]);

  const handleDownload = (file: MermaidFile) => {
    const a = document.createElement("a");
    a.href = file.downloadUrl;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (file: MermaidFile) => {
    if (!confirm(`Delete "${file.filename}"?`)) return;
    setDeletingFile(file.filename);
    try {
      await fetch(`/api/mermaid/${encodeURIComponent(file.filename)}`, { method: "DELETE" });
      await fetchFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingFile(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const erdFiles = files.filter((f) => f.type === "erd");
  const rulesFiles = files.filter((f) => f.type === "rules");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <FileCode2 className="w-7 h-7 text-primary" />
              Mermaid File Library
            </h1>
            <p className="text-muted-foreground mt-1">
              All ERD and business rules Mermaid files — download for use in external editors
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/rules"
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-xl text-sm transition-colors"
            >
              Rules Admin
            </Link>
            <button
              type="button"
              onClick={fetchFiles}
              className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-xl text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter by type:</span>
          {(["", "erd", "rules"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === t
                  ? "bg-primary text-white"
                  : "bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "" ? "All" : t === "erd" ? "ERD Files" : "Rules Files"}
            </button>
          ))}
          <span className="ml-auto text-sm text-muted-foreground">{files.length} files total</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-foreground">{files.length}</div>
            <div className="text-sm text-muted-foreground">Total Files</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-600">{erdFiles.length}</div>
            <div className="text-sm text-muted-foreground">ERD Files (.mmd)</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-purple-600">{rulesFiles.length}</div>
            <div className="text-sm text-muted-foreground">Rules Files (.mmd / .json)</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <FileCode2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground font-medium">No Mermaid files yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Export ERD or business rules from the project wizard to see files here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.filename}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    file.type === "rules"
                      ? "bg-purple-500/10 text-purple-600"
                      : "bg-blue-500/10 text-blue-600"
                  }`}
                >
                  {file.type === "rules" ? (
                    <GitBranch className="w-5 h-5" />
                  ) : (
                    <FileCode2 className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{file.filename}</span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                        file.type === "rules"
                          ? "bg-purple-500/10 text-purple-600"
                          : "bg-blue-500/10 text-blue-600"
                      }`}
                    >
                      {file.type === "rules" ? "Rules" : "ERD"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{file.projectName}</span>
                    <span>•</span>
                    <span>{formatDate(file.createdAt)}</span>
                    <span>•</span>
                    <span>{file.content.length.toLocaleString()} chars</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(file)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-lg text-sm transition-colors"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(file)}
                    disabled={deletingFile === file.filename}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 text-muted-foreground rounded-lg transition-colors disabled:opacity-50"
                    title="Delete file"
                  >
                    {deletingFile === file.filename ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-muted/50 rounded-xl border border-border text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">About Mermaid files</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong>ERD (.mmd)</strong> — Entity Relationship Diagrams in Mermaid{" "}
              <code className="font-mono text-xs">erDiagram</code> syntax
            </li>
            <li>
              <strong>Rules (.mmd)</strong> — Business logic in Mermaid{" "}
              <code className="font-mono text-xs">flowchart TD</code> syntax
            </li>
            <li>
              <strong>Rules (.json)</strong> — GoRules JSON Decision Model for runtime execution
            </li>
            <li>
              Use any Mermaid-compatible editor (mermaid.live, VS Code Mermaid Preview, etc.) with
              .mmd files
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
