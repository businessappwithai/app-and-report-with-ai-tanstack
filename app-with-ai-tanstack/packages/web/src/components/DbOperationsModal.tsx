import { AlertCircle, CheckCircle2, Database, Loader2, X } from "lucide-react";
import { useState } from "react";

interface DbOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  erdCode: string;
  projectId: string;
  onReverseEngineered: (mermaidCode: string) => void;
}

export function DbOperationsModal({
  isOpen,
  onClose,
  erdCode,
  onReverseEngineered,
}: DbOperationsModalProps) {
  const [connectionString, setConnectionString] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReverseEngineering, setIsReverseEngineering] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    message?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerateSchema = async () => {
    if (!connectionString.trim()) {
      setResult({ error: "Please enter a PostgreSQL connection string" });
      return;
    }
    setIsGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/db/generate-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mermaidCode: erdCode, targetDbConnection: connectionString }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error || "Failed to generate schema" });
      } else {
        setResult({ success: true, message: `Created tables: ${data.tablesCreated?.join(", ")}` });
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReverseEngineer = async () => {
    if (!connectionString.trim()) {
      setResult({ error: "Please enter a PostgreSQL connection string" });
      return;
    }
    setIsReverseEngineering(true);
    setResult(null);
    try {
      const res = await fetch("/api/db/reverse-engineer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDbConnection: connectionString }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error || "Failed to reverse-engineer" });
      } else {
        onReverseEngineered(data.mermaidCode);
        setResult({ success: true, message: "ERD updated from database schema" });
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setIsReverseEngineering(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold">Database Operations</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your PostgreSQL connection string. It will be encrypted and stored per project.
        </p>
        <input
          type="password"
          placeholder="postgresql://user:pass@host:5432/dbname"
          value={connectionString}
          onChange={(e) => setConnectionString(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm font-mono mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        {result && (
          <div
            className={`flex items-start gap-2 p-3 rounded-lg mb-4 text-sm ${
              result.error ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
            }`}
          >
            {result.error ? (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span>{result.error || result.message}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleGenerateSchema}
            disabled={isGenerating || isReverseEngineering}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Generate Schema
          </button>
          <button
            type="button"
            onClick={handleReverseEngineer}
            disabled={isGenerating || isReverseEngineering}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isReverseEngineering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Reverse Engineer
          </button>
        </div>
      </div>
    </div>
  );
}
