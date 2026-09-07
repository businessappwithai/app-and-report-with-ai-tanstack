import { AreaChart, BarChart3, LineChart, PieChart, ScatterChart } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EditorPanel } from "./EditorPanel";
import type { ChartType } from "@/types/database";

export const CHART_TYPES: {
  type: ChartType;
  icon: React.ReactNode;
  label: string;
  description: string;
  usage: string;
}[] = [
  {
    type: "bar",
    icon: <BarChart3 className="h-5 w-5" />,
    label: "Bar Chart",
    description: "Compare values across different categories using vertical bars",
    usage:
      "Best for: Comparing sales by region, population by country, revenue by product. Requires: 1 category field (X-axis) and 1+ value fields (Y-axis).",
  },
  {
    type: "line",
    icon: <LineChart className="h-5 w-5" />,
    label: "Line Chart",
    description: "Show trends and changes over time with connected data points",
    usage:
      "Best for: Stock prices, temperature over time, website traffic. Requires: 1 time/sequence field (X-axis) and 1+ value fields (Y-axis).",
  },
  {
    type: "area",
    icon: <AreaChart className="h-5 w-5" />,
    label: "Area Chart",
    description: "Show volume over time with filled areas under the line",
    usage:
      "Best for: Cumulative revenue, website traffic over time, inventory levels. Requires: 1 time/sequence field (X-axis) and 1+ value fields (Y-axis).",
  },
  {
    type: "pie",
    icon: <PieChart className="h-5 w-5" />,
    label: "Pie Chart",
    description: "Show proportions and percentages of a whole",
    usage:
      "Best for: Market share, budget allocation, survey results. Requires: 1 category field (X-axis) and 1 numeric value field (Y-axis). Shows data for the first series only.",
  },
  {
    type: "scatter",
    icon: <ScatterChart className="h-5 w-5" />,
    label: "Scatter Plot",
    description: "Show correlation and distribution between two numeric variables",
    usage:
      "Best for: Height vs weight, price vs demand, advertising vs sales. Requires: 2 numeric value fields (X and Y axes).",
  },
  {
    type: "column",
    icon: <BarChart3 className="h-5 w-5" />,
    label: "Column Chart",
    description: "Compare values across categories using horizontal bars",
    usage:
      "Best for: Long category names, ranking data, comparing performance. Requires: 1 category field (X-axis) and 1+ value fields (Y-axis).",
  },
  {
    type: "doughnut",
    icon: <PieChart className="h-5 w-5" />,
    label: "Doughnut Chart",
    description: "Show proportions with a hollow center, similar to pie chart",
    usage:
      "Best for: Showing progress toward goals, metric breakdown with center text. Requires: 1 category field and 1 numeric value. Shows first series only.",
  },
];

interface ChartTypeSelectorProps {
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
}

export function ChartTypeSelector({ chartType, onChartTypeChange }: ChartTypeSelectorProps) {
  return (
    <EditorPanel title="Chart Type" contentClassName="space-y-4">
      <Select value={chartType} onValueChange={(value) => onChartTypeChange(value as ChartType)}>
        <SelectTrigger>
          <SelectValue placeholder="Select chart type..." />
        </SelectTrigger>
        <SelectContent>
          {CHART_TYPES.map(({ type, icon, label, description }) => (
            <SelectItem key={type} value={type}>
              <div className="flex items-center gap-2">
                {icon}
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-gray-500">{description}</div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {chartType && (
        <div className="space-y-2">
          <Label htmlFor="chart-usage">How to Use This Chart</Label>
          <Textarea
            id="chart-usage"
            readOnly
            value={CHART_TYPES.find((ct) => ct.type === chartType)?.usage || ""}
            className="bg-gray-50 min-h-[120px] text-sm"
          />
        </div>
      )}
    </EditorPanel>
  );
}
