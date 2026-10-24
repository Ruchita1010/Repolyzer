"use client";
// components/ChartBlock.tsx
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from "chart.js";
import type { Stats } from "../lib/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function ChartBlock({ kind, stats }: { kind: "weekly" | "authors"; stats: Stats }) {
  const weekly = kind === "weekly";
  const src = weekly ? stats.weekly : stats.authors;
  if (!src.labels.length) return null;

  const data = {
    labels: src.labels,
    datasets: [
      {
        label: "Commits",
        data: src.values,
        backgroundColor: weekly ? "#4f46e5" : "#0d9488",
        borderRadius: 4,
      },
    ],
  };
  const options: any = {
    indexAxis: weekly ? "x" : "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#475569" } },
      y: { grid: { color: "#e2e8f0" }, ticks: { color: "#475569", precision: 0 }, beginAtZero: true },
    },
  };

  return (
    <figure className="my-6 rounded-xl border border-stone-200 bg-white p-4">
      <figcaption className="mb-3 text-sm font-semibold text-stone-700">
        {weekly ? "Commits per week" : "Top contributors (commits)"}
      </figcaption>
      <div className={weekly ? "h-60" : "h-56"}>
        <Bar data={data} options={options} />
      </div>
    </figure>
  );
}
