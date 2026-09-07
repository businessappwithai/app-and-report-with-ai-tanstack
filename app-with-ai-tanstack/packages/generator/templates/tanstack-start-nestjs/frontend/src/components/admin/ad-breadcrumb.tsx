import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface BreadcrumbLevel {
  label: string;
  recordName?: string;
  onClick?: () => void;
}

interface ADBreadcrumbProps {
  levels: BreadcrumbLevel[];
}

export function ADBreadcrumb({ levels }: ADBreadcrumbProps) {
  if (levels.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {levels.map((level, index) => {
          const isLast = index === levels.length - 1;
          const displayText = level.recordName
            ? `${level.label}: ${level.recordName}`
            : level.label;

          return (
            <BreadcrumbItem key={index}>
              {index > 0 && <BreadcrumbSeparator />}
              {isLast ? (
                <BreadcrumbPage className="font-medium">{displayText}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="cursor-pointer" onClick={level.onClick}>
                  {displayText}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
