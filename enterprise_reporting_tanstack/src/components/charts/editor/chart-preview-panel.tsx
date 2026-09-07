import { ChartRenderer } from "@/components/charts/chart-renderer";
import { EditorPanel } from "./EditorPanel";
import type { ChartConfig, ChartType, DataMapping } from "@/types/database";

interface ChartPreviewPanelProps {
  previewData: Record<string, unknown>[];
  availableFields: string[];
  chartType: ChartType;
  chartConfig: ChartConfig;
  dataMapping: DataMapping;
  selectedQueryId: string;
  isLoading: boolean;
}

export function ChartPreviewPanel({
  previewData,
  availableFields,
  chartType,
  chartConfig,
  dataMapping,
  selectedQueryId,
  isLoading,
}: ChartPreviewPanelProps) {
  return (
    <div className="space-y-6">
      <div className="sticky top-6">
        <EditorPanel title="Preview">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center">
              <p className="text-gray-500">Loading preview data...</p>
            </div>
          ) : !selectedQueryId ? (
            <div className="flex h-96 items-center justify-center">
              <p className="text-gray-500">Select a query to preview your chart</p>
            </div>
          ) : !dataMapping.xAxis.field || dataMapping.yAxis.length === 0 ? (
            <div className="flex h-96 items-center justify-center">
              <p className="text-gray-500">Configure X and Y axes to see the preview</p>
            </div>
          ) : (
            <ChartRenderer
              data={previewData}
              chartType={chartType}
              chartConfig={chartConfig}
              dataMapping={dataMapping}
            />
          )}
        </EditorPanel>
      </div>

      {previewData.length > 0 && (
        <EditorPanel title="Sample Data">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {availableFields.slice(0, 5).map((field) => (
                    <th key={field} className="p-2 text-left font-medium">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 5).map((row, i) => (
                  <tr key={Object.values(row).join("-") || `row-${i}`} className="border-b">
                    {availableFields.slice(0, 5).map((field) => (
                      <td key={field} className="p-2">
                        {String(row[field] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewData.length > 5 && (
            <p className="mt-2 text-xs text-gray-500">Showing 5 of {previewData.length} rows</p>
          )}
        </EditorPanel>
      )}
    </div>
  );
}
