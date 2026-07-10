"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface RevenueChartProps {
  data: {
    month: string;
    income: number;
    expense: number;
    profit: number;
  }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  // Custom interactive tooltip content
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const income = payload[0].value;
      const expense = payload[1].value;
      const profit = income - expense;
      const margin = income > 0 ? ((profit / income) * 100).toFixed(0) : "0";

      return (
        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-2">
          <p className="font-bold text-foreground text-sm border-b border-border/60 pb-1">{payload[0].payload.month}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Gelir:</span>
              <span className="font-semibold text-emerald-400">{formatCurrency(income)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Gider:</span>
              <span className="font-semibold text-rose-400">{formatCurrency(expense)}</span>
            </div>
            <div className="flex justify-between gap-6 pt-1 border-t border-border/40 font-bold">
              <span className="text-foreground">Net Kâr:</span>
              <span className={profit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {formatCurrency(profit)}
              </span>
            </div>
            <div className="flex justify-between gap-6 text-[10px] text-muted-foreground">
              <span>Kâr Marjı:</span>
              <span>{margin}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border/80 p-6 rounded-2xl shadow-md space-y-4">
      <div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Gelir ve Gider Karşılaştırması
        </h3>
        <p className="text-xs text-muted-foreground">
          Aylık finansal karşılaştırma grafiği.
        </p>
      </div>

      <div className="h-[280px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#ffffff50"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#ffffff50"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                if (v === 0) return "₺0";
                if (v < 1000) return `₺${v}`;
                const valueInK = v / 1000;
                if (valueInK % 1 === 0) {
                  return `₺${valueInK.toFixed(0)}k`;
                }
                return `₺${valueInK.toFixed(1)}k`;
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255, 255, 255, 0.02)" }} />
            <Bar
              dataKey="income"
              name="Gelir"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="expense"
              name="Gider"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend */}
      <div className="flex justify-center gap-6 text-xs select-none">
        <div className="flex items-center gap-2 font-medium text-foreground/80">
          <span className="w-3 h-3 rounded bg-emerald-500" />
          <span>Toplam Gelir</span>
        </div>
        <div className="flex items-center gap-2 font-medium text-foreground/80">
          <span className="w-3 h-3 rounded bg-rose-500" />
          <span>Toplam Gider</span>
        </div>
      </div>
    </div>
  );
}
