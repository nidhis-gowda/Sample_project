"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { EmptyState } from "@/components/ui/Card";

/**
 * Chart.js wrappers.
 *
 * Charts are registered once at module scope and rendered client-side only, so
 * the server-rendered page never produces a canvas mismatch.
 */

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

ChartJS.defaults.font.family =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
ChartJS.defaults.color = "#64748b";

const PALETTE = [
  "#4f46e5",
  "#0ea5e9",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#db2777",
  "#64748b",
];

function baseOptions(horizontal: boolean): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        padding: 10,
        cornerRadius: 8,
        titleFont: { size: 12, weight: 600 },
        bodyFont: { size: 12 },
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { display: horizontal, color: "#e2e8f0" },
        border: { display: false },
        ticks: { font: { size: 11 }, maxRotation: horizontal ? 0 : 45, minRotation: 0 },
      },
      y: {
        grid: { display: !horizontal, color: "#e2e8f0" },
        border: { display: false },
        ticks: { font: { size: 11 }, precision: 0 },
        beginAtZero: true,
      },
    },
  };
}

export function BarChart({
  labels,
  values,
  height = 260,
  horizontal = false,
  colors,
  suffix = "",
  emptyLabel = "No data to display yet.",
}: {
  labels: string[];
  values: number[];
  height?: number;
  horizontal?: boolean;
  colors?: string[];
  suffix?: string;
  emptyLabel?: string;
}) {
  const hasData = labels.length > 0 && values.some((value) => value > 0);

  if (!hasData) return <EmptyState title="Nothing to chart yet" description={emptyLabel} />;

  const background = colors ?? labels.map((_, index) => PALETTE[index % PALETTE.length]);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: horizontal ? background : labels.map((_, i) => background[i % background.length]),
        borderRadius: 6,
        maxBarThickness: 34,
      },
    ],
  };

  const options = baseOptions(horizontal);
  if (horizontal) {
    options.indexAxis = "y";
  }

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} aria-label="Bar chart" />
    </div>
  );
}

export function DoughnutChart({
  labels,
  values,
  height = 260,
  colors,
  emptyLabel = "No data to display yet.",
}: {
  labels: string[];
  values: number[];
  height?: number;
  colors?: string[];
  emptyLabel?: string;
}) {
  const hasData = labels.length > 0 && values.some((value) => value > 0);

  if (!hasData) return <EmptyState title="Nothing to chart yet" description={emptyLabel} />;

  const palette = colors ?? PALETTE;
  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: labels.map((_, index) => palette[index % palette.length]),
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, boxHeight: 10, padding: 12, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: "#0f172a",
        padding: 10,
        cornerRadius: 8,
      },
    },
  };

  return (
    <div style={{ height }}>
      <Doughnut data={data} options={options} aria-label="Doughnut chart" />
    </div>
  );
}

/** Grouped bar chart used for required vs. allocated project staffing. */
export function GroupedBarChart({
  labels,
  series,
  height = 280,
}: {
  labels: string[];
  series: Array<{ label: string; values: number[]; color: string }>;
  height?: number;
}) {
  const hasData = labels.length > 0 && series.some((item) => item.values.some((v) => v > 0));

  if (!hasData) {
    return <EmptyState title="No staffing data" description="Assign a team to a project to see coverage." />;
  }

  const data = {
    labels,
    datasets: series.map((item) => ({
      label: item.label,
      data: item.values,
      backgroundColor: item.color,
      borderRadius: 6,
      maxBarThickness: 28,
    })),
  };

  const options = baseOptions(false);
  options.plugins = {
    ...options.plugins,
    legend: { display: true, position: "top", labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} aria-label="Grouped bar chart" />
    </div>
  );
}