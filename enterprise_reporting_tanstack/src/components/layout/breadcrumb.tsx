import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const { location } = useRouterState();
  const pathname = location.pathname;

  const defaultItems: BreadcrumbItem[] = pathname
    .split("/")
    .filter(Boolean)
    .map((segment, index, array) => {
      const href = `/${array.slice(0, index + 1).join("/")}`;
      const label = segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      return { label, href };
    });

  const breadcrumbItems = items || defaultItems;

  return (
    <nav className={cn("flex items-center space-x-1 text-sm", className)}>
      <Link to="/" className="flex items-center text-muted-foreground hover:text-foreground">
        <Home className="h-4 w-4" />
      </Link>

      {breadcrumbItems.map((item, index) => (
        <div key={item.label + (item.href ?? "")} className="flex items-center">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {item.href && index < breadcrumbItems.length - 1 ? (
            <Link to={item.href} className="ml-1 text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="ml-1 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
