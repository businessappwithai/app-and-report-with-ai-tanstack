import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EditorPanel } from "./EditorPanel";
import type { ChartConfig, ChartType } from "@/types/database";
import { getTremorChartColor, getTremorChartPalette } from "@/lib/theme/tremor-colors";

interface ChartAppearanceProps {
  chartConfig: ChartConfig;
  chartType: ChartType;
  onChartConfigChange: (config: ChartConfig) => void;
}

export function ChartAppearance({
  chartConfig,
  chartType,
  onChartConfigChange,
}: ChartAppearanceProps) {
  return (
    <EditorPanel title="Appearance" contentClassName="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="show-title">Show Title</Label>
        <Switch
          id="show-title"
          checked={chartConfig.title.show}
          onCheckedChange={(checked) =>
            onChartConfigChange({
              ...chartConfig,
              title: { ...chartConfig.title, show: checked },
            })
          }
        />
      </div>
      {chartConfig.title.show && (
        <Input
          value={chartConfig.title.text}
          onChange={(e) =>
            onChartConfigChange({
              ...chartConfig,
              title: { ...chartConfig.title, text: e.target.value },
            })
          }
          placeholder="Chart title"
        />
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor="show-legend">Show Legend</Label>
        <Switch
          id="show-legend"
          checked={chartConfig.legend.show}
          onCheckedChange={(checked) =>
            onChartConfigChange({
              ...chartConfig,
              legend: { ...chartConfig.legend, show: checked },
            })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="enable-tooltip">Enable Tooltip</Label>
        <Switch
          id="enable-tooltip"
          checked={chartConfig.tooltip.enabled}
          onCheckedChange={(checked) =>
            onChartConfigChange({ ...chartConfig, tooltip: { enabled: checked } })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="enable-animation">Animation</Label>
        <Switch
          id="enable-animation"
          checked={chartConfig.animation}
          onCheckedChange={(checked) => onChartConfigChange({ ...chartConfig, animation: checked })}
        />
      </div>

      {(chartType === "bar" || chartType === "column") && (
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="enable-stacked">Stacked Chart</Label>
            <p className="text-xs text-gray-500">
              Stack multiple series on top of each other (for bar/column charts)
            </p>
          </div>
          <Switch
            id="enable-stacked"
            checked={chartConfig.stacked || false}
            onCheckedChange={(checked) => onChartConfigChange({ ...chartConfig, stacked: checked })}
          />
        </div>
      )}

      <div>
        <Label>Chart Colors</Label>
        <p className="mb-2 text-tremor-label text-tremor-content">
          Customize the color palette for your chart. Click to edit.
        </p>
        <div className="flex flex-wrap gap-2">
          {chartConfig.colors.map((color, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: order matters for color palette
            <div key={index} className="flex items-center gap-1">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  const newColors = [...chartConfig.colors];
                  newColors[index] = e.target.value;
                  onChartConfigChange({ ...chartConfig, colors: newColors });
                }}
                className="h-8 w-12 rounded cursor-pointer border-2"
                title={`Color ${index + 1}: ${color}`}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => {
                  const newColors = chartConfig.colors.filter((_, i) => i !== index);
                  onChartConfigChange({
                    ...chartConfig,
                    colors: newColors.length > 0 ? newColors : chartConfig.colors,
                  });
                }}
                disabled={chartConfig.colors.length <= 1}
                title="Remove color"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onChartConfigChange({
                ...chartConfig,
                colors: [...chartConfig.colors, getTremorChartColor(chartConfig.colors.length)],
              })
            }
            disabled={chartConfig.colors.length >= 12}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          onClick={() =>
            onChartConfigChange({
              ...chartConfig,
              // Tremor's categorical palette, in series-assignment order
              colors: getTremorChartPalette(9),
            })
          }
        >
          Reset to Default
        </Button>
      </div>
    </EditorPanel>
  );
}
