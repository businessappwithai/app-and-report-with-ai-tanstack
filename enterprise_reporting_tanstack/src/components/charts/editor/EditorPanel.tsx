import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EditorPanelProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  contentClassName?: string;
}

export function EditorPanel({ title, description, children, contentClassName }: EditorPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-tremor-default font-medium text-tremor-content">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
