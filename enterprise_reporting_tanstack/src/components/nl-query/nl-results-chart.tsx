"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getTremorChartPalette,
  TremorChartLegend,
  TremorChartTooltip,
  tremorAreaProps,
  tremorBarProps,
  tremorCursorProps,
  tremorGridProps,
  tremorLineProps,
  tremorXAxisProps,
  tremorYAxisProps,
} from "@/components/charts/tremor-chart-theme";
import type { NlChartConfig } from "@/types/database";

interface NlResultsChartProps {
  data: Record<string, unknown>[];
  config: NlChartConfig;
}

// Series colours follow the Tremor categorical palette
// (blue → emerald → violet → amber → gray → cyan → pink → lime → fuchsia).
const DEFAULT_COLORS = getTremorChartPalette(9);

export function NlResultsChart({ data, config }: NlResultsChartProps) {
  const colors = config.colors || DEFAULT_COLORS;

  // Prepare chart data
  const chartData = useMemo(() => {
    return data.map((row) => {
      const point: Record<string, unknown> = {};
      point[config.xAxis.field] = row[config.xAxis.field];

      for (const yField of config.yAxis) {
        const val = row[yField.field];
        point[yField.field] = typeof val === "number" ? val : Number(val) || 0;
      }

      return point;
    });
  }, [data, config]);

  const renderChart = () => {
    switch (config.chartType) {
      case "bar":
        return (
          <BarChart data={chartData}>
            <CartesianGrid {...tremorGridProps} />
            <XAxis
              {...tremorXAxisProps}
              dataKey={config.xAxis.field}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis {...tremorYAxisProps} />
            <Tooltip content={<TremorChartTooltip />} cursor={tremorCursorProps} />
            <Legend content={<TremorChartLegend />} />
            {config.yAxis.map((yField, idx) => (
              <Bar
                key={yField.field}
                dataKey={yField.field}
                name={yField.label}
                fill={colors[idx % colors.length]}
                {...tremorBarProps}
              />
            ))}
          </BarChart>
        );

      case "line":
        return (
          <LineChart data={chartData}>
            <CartesianGrid {...tremorGridProps} />
            <XAxis
              {...tremorXAxisProps}
              dataKey={config.xAxis.field}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis {...tremorYAxisProps} />
            <Tooltip content={<TremorChartTooltip />} cursor={tremorCursorProps} />
            <Legend content={<TremorChartLegend />} />
            {config.yAxis.map((yField, idx) => (
              <Line
                key={yField.field}
                {...tremorLineProps}
                dataKey={yField.field}
                name={yField.label}
                stroke={colors[idx % colors.length]}
              />
            ))}
          </LineChart>
        );

      case "area":
        return (
          <AreaChart data={chartData}>
            <CartesianGrid {...tremorGridProps} />
            <XAxis
              {...tremorXAxisProps}
              dataKey={config.xAxis.field}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis {...tremorYAxisProps} />
            <Tooltip content={<TremorChartTooltip />} cursor={tremorCursorProps} />
            <Legend content={<TremorChartLegend />} />
            {config.yAxis.map((yField, idx) => (
              <Area
                key={yField.field}
                {...tremorAreaProps}
                dataKey={yField.field}
                name={yField.label}
                fill={colors[idx % colors.length]}
                stroke={colors[idx % colors.length]}
              />
            ))}
          </AreaChart>
        );

      case "pie":
        return (
          <PieChart>
            <Tooltip content={<TremorChartTooltip />} />
            <Legend content={<TremorChartLegend />} />
            <Pie
              data={chartData}
              dataKey={config.yAxis[0]?.field || ""}
              nameKey={config.xAxis.field}
              cx="50%"
              cy="50%"
              outerRadius={150}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
            >
              {chartData.map((entry, idx) => (
                <Cell
                  key={String(entry[config.xAxis.field] ?? idx)}
                  fill={colors[idx % colors.length]}
                />
              ))}
            </Pie>
          </PieChart>
        );

      case "scatter":
        return (
          <ScatterChart>
            <CartesianGrid {...tremorGridProps} />
            <XAxis {...tremorXAxisProps} dataKey={config.xAxis.field} name={config.xAxis.label} />
            <YAxis
              {...tremorYAxisProps}
              dataKey={config.yAxis[0]?.field}
              name={config.yAxis[0]?.label}
            />
            <Tooltip content={<TremorChartTooltip />} cursor={tremorCursorProps} />
            <Legend content={<TremorChartLegend />} />
            <Scatter name={config.title} data={chartData} fill={colors[0]} />
          </ScatterChart>
        );

      default:
        return (
          <div className="flex h-full items-center justify-center text-tremor-default text-tremor-content">
            Unsupported chart type: {config.chartType}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-center text-tremor-title font-medium text-tremor-content-strong">
        {config.title}
      </h3>
      <div style={{ width: "100%", height: 400 }}>
        <ResponsiveContainer>{renderChart()}</ResponsiveContainer>
      </div>
      <p className="text-center text-tremor-label text-tremor-content">
        {chartData.length} data points &middot; {config.chartType} chart
      </p>
    </div>
  );
}
