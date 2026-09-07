import { Skeleton } from "@/components/ui/skeleton";

export function TableRowsSkeleton({ cols = 5, rows = 8 }: { cols?: number; rows?: number }) {
  return (
    <div className="border-2 border-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className={`h-4 ${j === 0 ? "w-8" : j === cols - 1 ? "w-20" : "flex-1"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
