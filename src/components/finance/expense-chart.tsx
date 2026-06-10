"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { TRANSACTION_CATEGORIES } from "@/lib/constants";

interface ExpenseChartProps {
  transactions: any[];
}

const CATEGORY_COLORS: Record<string, string> = {
  hosting: "#3b82f6",     // Blue
  domain: "#06b6d4",      // Cyan
  software: "#8b5cf6",    // Purple
  salary: "#ec4899",      // Pink
  marketing: "#f59e0b",   // Amber
  office: "#10b981",      // Emerald
  tax: "#ef4444",         // Red
  other: "#6b7280",       // Gray
};

export function ExpenseChart({ transactions }: ExpenseChartProps) {
  const chartData = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === "expense");
    const totals: Record<string, number> = {};

    expenses.forEach((t) => {
      const cat = t.category || "other";
      totals[cat] = (totals[cat] || 0) + (Number(t.amount) || 0);
    });

    const categoriesList = TRANSACTION_CATEGORIES.expense;

    return categoriesList
      .map((cat) => {
        const amount = totals[cat.value] || 0;
        return {
          name: cat.label,
          value: amount,
          color: CATEGORY_COLORS[cat.value] || "#6b7280",
          key: cat.value,
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  // Custom interactive tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = totalExpense > 0 ? ((data.value / totalExpense) * 100).toFixed(0) : "0";

      return (
        <div className="bg-card border border-border/80 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1">
          <p className="font-bold text-foreground flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span>{data.name}</span>
          </p>
          <div className="flex justify-between gap-6 pt-0.5 font-semibold">
            <span className="text-muted-foreground">Miktar:</span>
            <span className="text-foreground">{formatCurrency(data.value)}</span>
          </div>
          <div className="flex justify-between gap-6 text-[10px] text-muted-foreground">
            <span>Pay:</span>
            <span>{percentage}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const hasExpenses = chartData.length > 0;

  return (
    <div className="bg-card border border-border/80 p-6 rounded-2xl shadow-md flex flex-col justify-between space-y-6">
      <div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Gider Dağılımı
        </h3>
        <p className="text-xs text-muted-foreground">
          Kategoriye göre gruplandırılmış giderlerin dağılımı.
        </p>
      </div>

      {!hasExpenses ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
          <p>Kayıtlı gider bulunamadı</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Gider kayıtları girildiğinde bu grafik doldurulacaktır.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          {/* Donut Chart */}
          <div className="h-[180px] relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={76}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0a0a0f" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Label */}
            <div className="absolute text-center select-none pointer-events-none">
              <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Toplam</span>
              <span className="block text-sm font-bold text-foreground mt-0.5 font-mono">
                {formatCurrency(totalExpense)}
              </span>
            </div>
          </div>

          {/* Breakdown list */}
          <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
            {chartData.map((item) => {
              const percentage = ((item.value / totalExpense) * 100).toFixed(0);
              return (
                <div key={item.key} className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-foreground/90 truncate">{item.name}</span>
                    <span className="text-[10px] text-muted-foreground">({percentage}%)</span>
                  </div>
                  <span className="font-mono font-semibold text-foreground/80 shrink-0 select-all">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
