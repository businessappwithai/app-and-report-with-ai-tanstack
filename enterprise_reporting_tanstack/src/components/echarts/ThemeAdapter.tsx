"use client";

/**
 * ECharts theme adapter for the Tremor design system.
 *
 * Translates the Tremor tokens into ECharts option objects so canvas-rendered
 * charts match the Tremor components around them:
 *
 * - Series colours follow Tremor's categorical order (blue → emerald → violet → …)
 * - Axis lines and tick marks are hidden; only horizontal grid lines are drawn
 * - Tick labels use the Tremor label size on `content` grey
 * - Tooltips are a Tremor dropdown surface (radius 8px, `shadow-tremor-dropdown`)
 *
 * Colours are resolved to hex here rather than passed as `hsl(var(--token))`,
 * because ECharts paints to canvas and cannot resolve CSS custom properties.
 */

import type { EChartsOption } from "echarts";
import {
  TREMOR_CHART_COLORS,
  TREMOR_DARK,
  TREMOR_LIGHT,
  getTremorTokens,
} from "@/lib/theme/tremor-colors";

/** Tremor's categorical palette, in series-assignment order. */
export function getEChartsThemeColors(): string[] {
  return [...TREMOR_CHART_COLORS];
}

const TREMOR_LABEL_SIZE = 12; // text-tremor-label
const TREMOR_DEFAULT_SIZE = 14; // text-tremor-default
const FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, sans-serif";

export function getBaseEChartsOption(isDark: boolean): EChartsOption {
  const tokens = getTremorTokens(isDark);

  const contentColor = tokens.content.DEFAULT; // gray-500 — axis + legend labels
  const strongColor = tokens.content.strong; // titles, tooltip values
  const emphasisColor = tokens.content.emphasis; // tooltip label text
  const gridColor = tokens.border; // grid lines
  const surfaceColor = tokens.background.DEFAULT; // tooltip surface

  const axisDefaults = {
    // Tremor hides the axis rule and tick marks, keeping only the labels
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: contentColor,
      fontSize: TREMOR_LABEL_SIZE,
      fontFamily: FONT_FAMILY,
    },
    splitLine: {
      show: true,
      lineStyle: { color: gridColor, width: 1, type: "solid" as const },
    },
  };

  return {
    backgroundColor: "transparent",
    textStyle: {
      color: contentColor,
      fontFamily: FONT_FAMILY,
      fontSize: TREMOR_DEFAULT_SIZE,
    },
    title: {
      textStyle: {
        color: strongColor,
        fontSize: 18, // text-tremor-title
        fontWeight: 500,
        fontFamily: FONT_FAMILY,
      },
      subtextStyle: {
        color: contentColor,
        fontSize: TREMOR_DEFAULT_SIZE,
        fontFamily: FONT_FAMILY,
      },
    },
    legend: {
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: {
        color: contentColor,
        fontSize: TREMOR_DEFAULT_SIZE,
        fontFamily: FONT_FAMILY,
      },
    },
    tooltip: {
      backgroundColor: surfaceColor,
      borderColor: gridColor,
      borderWidth: 1,
      borderRadius: 8, // rounded-tremor-default
      padding: [8, 12],
      extraCssText: "box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);",
      textStyle: {
        color: emphasisColor,
        fontSize: TREMOR_DEFAULT_SIZE,
        fontFamily: FONT_FAMILY,
      },
      axisPointer: {
        lineStyle: { color: gridColor },
        crossStyle: { color: gridColor },
      },
    },
    // Tremor charts drop vertical grid lines on the category axis
    xAxis: { ...axisDefaults, splitLine: { show: false } },
    yAxis: axisDefaults,
  };
}

/** Hex values for the Tremor surface tokens, for engines that need them directly. */
export function getEChartsSurfaceColors(isDark: boolean) {
  const tokens = isDark ? TREMOR_DARK : TREMOR_LIGHT;
  return {
    background: tokens.background.DEFAULT,
    canvas: tokens.background.muted,
    border: tokens.border,
    content: tokens.content.DEFAULT,
    contentEmphasis: tokens.content.emphasis,
    contentStrong: tokens.content.strong,
    brand: tokens.brand.DEFAULT,
  };
}
