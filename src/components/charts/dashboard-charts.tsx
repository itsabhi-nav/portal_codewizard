"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { formatINR } from "@/lib/money";

const compactINR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});
import type { DashboardMetrics } from "@/lib/dashboard-service";

const STATUS_COLORS: Record<string, string> = {
  live: "#10b981",
  development: "#3b82f6",
  testing: "#f59e0b",
  suspended: "#ef4444",
  archived: "#94a3b8",
};

function RupeeTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatINR(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function RevenueAreaChart({ data }: { data: DashboardMetrics["charts"]["monthlyRevenue"] }) {
  return (
    <div className="h-[210px] w-full sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="devGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="amcGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => compactINR.format(value / 100)}
            width={48}
          />
          <Tooltip content={<RupeeTooltip />} />
          <Area type="monotone" dataKey="development" name="Development" stroke="#3b82f6" fill="url(#devGradient)" strokeWidth={2} />
          <Area type="monotone" dataKey="amc" name="AMC" stroke="#8b5cf6" fill="url(#amcGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueSplitChart({ data }: { data: DashboardMetrics["charts"]["revenueSplit"] }) {
  const chartData = [
    { name: "Development", value: data.development, color: "#3b82f6" },
    { name: "AMC", value: data.amc, color: "#8b5cf6" },
    { name: "Other", value: data.other, color: "#06b6d4" },
  ].filter((item) => item.value > 0);

  if (chartData.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-muted-foreground sm:py-16 sm:text-sm">
        No revenue recorded yet.
      </p>
    );
  }

  return (
    <div className="h-[200px] w-full sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<RupeeTooltip />} />
          <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WebsiteStatusChart({ data }: { data: DashboardMetrics["charts"]["websiteStatusDistribution"] }) {
  const chartData = data.map((item) => ({
    name: item.status.replace(/_/g, " "),
    count: item.count,
    fill: STATUS_COLORS[item.status] ?? "#94a3b8",
  }));

  if (chartData.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-muted-foreground sm:py-16 sm:text-sm">
        No websites yet.
      </p>
    );
  }

  return (
    <div className="h-[200px] w-full sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} width={32} />
          <Tooltip content={<RupeeTooltip />} />
          <Bar dataKey="count" name="Websites" radius={[6, 6, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
