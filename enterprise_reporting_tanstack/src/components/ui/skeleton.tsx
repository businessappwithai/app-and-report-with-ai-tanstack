import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-tremor-default bg-tremor-background-subtle", className)}
      {...props}
    />
  );
}

export { Skeleton };
