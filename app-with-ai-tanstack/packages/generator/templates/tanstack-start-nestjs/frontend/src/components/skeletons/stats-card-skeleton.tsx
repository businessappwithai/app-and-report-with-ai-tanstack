import { Skeleton } from "@/components/ui/skeleton";

function StatCardSkeleton() {
  return (
    <div className="border-t border-b border-border border-r p-6 flex flex-col justify-between bg-card">
      <div className="space-y-5">
        <Skeleton className="h-7 w-7" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-12" />
      </div>
      <Skeleton className="h-3 w-20 mt-3" />
    </div>
  );
}

export function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-0 border-l border-r border-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}
