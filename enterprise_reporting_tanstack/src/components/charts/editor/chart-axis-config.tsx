import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditorPanel } from "./EditorPanel";
import type { ChartConfig, DataMapping, SeriesMapping } from "@/types/database";

function hslToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generateRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 60 + Math.floor(Math.random() * 30);
  const lightness = 45 + Math.floor(Math.random() * 15);
  return hslToHex(hue, saturation, lightness);
}

interface ChartAxisConfigProps {
  dataMapping: DataMapping;
  availableFields: string[];
  chartConfig: ChartConfig;
  onDataMappingChange: (mapping: DataMapping) => void;
}

export function ChartAxisConfig({
  dataMapping,
  availableFields,
  chartConfig,
  onDataMappingChange,
}: ChartAxisConfigProps) {
  const addYSeries = () => {
    const existingColors = dataMapping.yAxis.map((s) => s.color).filter(Boolean) as string[];
    let newColor = generateRandomColor();
    let attempts = 0;
    while (existingColors.includes(newColor) && attempts < 10) {
      newColor = generateRandomColor();
      attempts++;
    }
    onDataMappingChange({
      ...dataMapping,
      yAxis: [...dataMapping.yAxis, { field: "", label: "", color: newColor }],
    });
  };

  const updateYSeries = (index: number, updates: Partial<SeriesMapping>) => {
    const newYAxis = [...dataMapping.yAxis];
    newYAxis[index] = { ...newYAxis[index], ...updates };
    onDataMappingChange({ ...dataMapping, yAxis: newYAxis });
  };

  const removeYSeries = (index: number) => {
    onDataMappingChange({
      ...dataMapping,
      yAxis: dataMapping.yAxis.filter((_, i) => i !== index),
    });
  };

  return (
    <EditorPanel title="Axis Configuration" contentClassName="space-y-4">
      {/* X-Axis */}
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="x-axis">X-Axis (Categories) *</Label>
          {dataMapping.xAxis.field && dataMapping.xAxis.field !== "" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() =>
                onDataMappingChange({ ...dataMapping, xAxis: { field: "", label: "" } })
              }
            >
              Clear
            </Button>
          )}
        </div>
        <Select
          value={dataMapping.xAxis.field}
          onValueChange={(value) => {
            if (value === "__none__") {
              onDataMappingChange({ ...dataMapping, xAxis: { field: "", label: "" } });
            } else {
              onDataMappingChange({
                ...dataMapping,
                xAxis: { ...dataMapping.xAxis, field: value, label: value },
              });
            }
          }}
        >
          <SelectTrigger id="x-axis">
            <SelectValue placeholder="Select field..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {availableFields.map((field) => (
              <SelectItem key={field} value={field}>
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dataMapping.xAxis.field &&
          dataMapping.xAxis.field !== "__none__" &&
          dataMapping.xAxis.field !== "" && (
            <Input
              className="mt-2"
              value={dataMapping.xAxis.label}
              onChange={(e) =>
                onDataMappingChange({
                  ...dataMapping,
                  xAxis: { ...dataMapping.xAxis, label: e.target.value },
                })
              }
              placeholder="Axis label"
            />
          )}
      </div>

      {/* Y-Axis Series */}
      <div>
        <div className="flex items-center justify-between">
          <Label>Y-Axis (Values) *</Label>
          <Button size="sm" variant="outline" onClick={addYSeries}>
            <Plus className="mr-1 h-3 w-3" />
            Add Series
          </Button>
        </div>
        {dataMapping.yAxis.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">Add at least one Y-axis series</p>
        )}
        {dataMapping.yAxis.map((series, index) => (
          <div key={series.field || index} className="mt-2 space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Series {index + 1}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={series.color || chartConfig.colors[index % chartConfig.colors.length]}
                    onChange={(e) => updateYSeries(index, { color: e.target.value })}
                    className="h-6 w-8 rounded cursor-pointer border-2"
                    title="Choose color for this series"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => updateYSeries(index, { color: generateRandomColor() })}
                    title="Generate random color"
                  >
                    🎲 Random
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => updateYSeries(index, { field: "", label: "" })}
                >
                  Clear
                </Button>
                {dataMapping.yAxis.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => removeYSeries(index)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <Select
              value={series.field}
              onValueChange={(value) => {
                if (value === "__none__") {
                  updateYSeries(index, { field: "", label: "" });
                } else {
                  updateYSeries(index, { field: value, label: value });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {availableFields.map((field) => (
                  <SelectItem key={field} value={field}>
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={series.label}
              onChange={(e) => updateYSeries(index, { label: e.target.value })}
              placeholder="Series label"
            />
          </div>
        ))}
      </div>

      {/* Group By */}
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="group-by">Group By (Optional)</Label>
          {dataMapping.groupBy && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => onDataMappingChange({ ...dataMapping, groupBy: "" })}
            >
              Clear
            </Button>
          )}
        </div>
        <Select
          value={dataMapping.groupBy}
          onValueChange={(value) =>
            onDataMappingChange({ ...dataMapping, groupBy: value === "__none__" ? "" : value })
          }
        >
          <SelectTrigger id="group-by">
            <SelectValue placeholder="Select field to group by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {availableFields.map((field) => (
              <SelectItem key={field} value={field}>
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Color By */}
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="color-by">Color By (Optional)</Label>
          {dataMapping.colorBy && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => onDataMappingChange({ ...dataMapping, colorBy: "" })}
            >
              Clear
            </Button>
          )}
        </div>
        <Select
          value={dataMapping.colorBy}
          onValueChange={(value) =>
            onDataMappingChange({ ...dataMapping, colorBy: value === "__none__" ? "" : value })
          }
        >
          <SelectTrigger id="color-by">
            <SelectValue placeholder="Select field to color by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {availableFields.map((field) => (
              <SelectItem key={field} value={field}>
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </EditorPanel>
  );
}
