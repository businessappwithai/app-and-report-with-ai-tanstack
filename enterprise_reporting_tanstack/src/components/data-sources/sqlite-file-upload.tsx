import { Check, FolderOpen, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SqliteFileUploadProps {
  fileName: string;
  uploading: boolean;
  compact?: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function SqliteFileUpload({
  fileName,
  uploading,
  compact = false,
  fileInputRef,
  onFileSelect,
  onDragOver,
  onDrop,
}: SqliteFileUploadProps) {
  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") !uploading && fileInputRef.current?.click();
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg text-center transition-colors ${
          compact ? "p-4" : "p-6"
        } ${uploading ? "bg-muted cursor-not-allowed" : "cursor-pointer hover:bg-accent/50"}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2
              className={`mx-auto mb-2 animate-spin text-muted-foreground ${compact ? "h-6 w-6" : "h-8 w-8"}`}
            />
            <p className="text-sm font-medium">Uploading{compact ? "..." : " file..."}</p>
          </>
        ) : (
          <>
            <FolderOpen
              className={`mx-auto mb-2 text-muted-foreground ${compact ? "h-6 w-6 mb-1" : "h-8 w-8"}`}
            />
            <p className="text-sm font-medium">
              {fileName ||
                (compact
                  ? "Click to browse or drag & drop to change file"
                  : "Click to browse or drag & drop SQLite file")}
            </p>
            {!compact && (
              <p className="text-xs text-muted-foreground mt-1">
                File will be uploaded to:{" "}
                <code className="bg-muted px-1 py-0.5 rounded">data/uploads/</code>
              </p>
            )}
            {compact && (
              <p className="text-tremor-label text-tremor-content">
                Upload to: <code className="bg-muted px-1 py-0.5 rounded">data/uploads/</code>
              </p>
            )}
          </>
        )}
        <Input
          ref={fileInputRef}
          type="file"
          accept=".db,.sqlite,.sqlite3"
          onChange={onFileSelect}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {fileName && (
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 p-3">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
            <Check className="h-4 w-4" />
            {compact ? `Ready to use: ${fileName}` : "File uploaded successfully"}
          </p>
          {!compact && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
              data/uploads/{fileName}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
