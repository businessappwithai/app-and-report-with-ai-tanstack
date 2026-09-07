import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditorPanel } from "./EditorPanel";
import type { SavedQuery } from "@/types/database";

interface ChartDataSourceProps {
  queries: SavedQuery[] | undefined;
  selectedQueryId: string;
  availableFields: string[];
  onQueryChange: (queryId: string) => void;
}

export function ChartDataSource({
  queries,
  selectedQueryId,
  availableFields,
  onQueryChange,
}: ChartDataSourceProps) {
  const selectedQuery = queries?.find((q) => q.id === selectedQueryId);

  return (
    <EditorPanel title="Data Source" contentClassName="space-y-4">
      <div>
        <Label htmlFor="query-select">Select Query *</Label>
        <Select value={selectedQueryId} onValueChange={onQueryChange}>
          <SelectTrigger id="query-select">
            <SelectValue placeholder="Choose a saved query..." />
          </SelectTrigger>
          <SelectContent>
            {queries?.map((query) => (
              <SelectItem key={query.id} value={query.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{query.name}</span>
                  <span className="text-xs text-gray-500">
                    {query.description || "No description"}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedQuery && (
          <p className="mt-2 text-sm text-gray-500">
            Using: <span className="font-medium">{selectedQuery.name}</span>
          </p>
        )}
      </div>

      {availableFields.length > 0 && (
        <div className="rounded-md bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Available Fields</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {availableFields.map((field) => (
                  <Badge key={field} variant="secondary" className="text-xs">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </EditorPanel>
  );
}
