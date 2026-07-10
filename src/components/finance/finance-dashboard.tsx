"use client";

import { useState, useMemo } from "react";
import type { Client, Project } from "@/types/database";
import { formatCurrency, cn } from "@/lib/utils";
import { RevenueChart } from "./revenue-chart";
import { ExpenseChart } from "./expense-chart";
import { LedgerGrid } from "./ledger-grid";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  RefreshCw,
  Calendar,
  ChevronDown,
} from "lucide-react";

interface FinanceDashboardProps {
  initialTransactions: any[];
  clients: Client[];
  projects: Project[];
  userRole: "owner" | "admin" | "member" | "client";
}

const MONTHS = [
  { val: "All", label: "Tüm Aylar" },
  { val: "01", label: "Ocak" },
  { val: "02", label: "Şubat" },
  { val: "03", label: "Mart" },
  { val: "04", label: "Nisan" },
  { val: "05", label: "Mayıs" },
  { val: "06", label: "Haziran" },
  { val: "07", label: "Temmuz" },
  { val: "08", label: "Ağustos" },
  { val: "09", label: "Eylül" },
  { val: "10", label: "Ekim" },
  { val: "11", label: "Kasım" },
  { val: "12", label: "Aralık" },
];

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  align?: "left" | "right";
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  align = "left",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 bg-transparent text-sm font-semibold text-foreground hover:text-foreground/80 focus:outline-none cursor-pointer pr-1 py-1"
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
            isOpen && "transform rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={cn(
              "absolute mt-2 w-40 max-h-60 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md text-popover-foreground shadow-2xl z-50 py-1.5 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3.5 py-2 text-xs transition-colors hover:bg-muted font-medium flex items-center justify-between",
                  opt.value === value
                    ? "text-burgundy bg-burgundy/5 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{opt.label}</span>
                {opt.value === value && (
                  <span className="w-1.5 h-1.5 rounded-full bg-burgundy" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function FinanceDashboard({
  initialTransactions,
  clients,
  projects,
  userRole,
}: FinanceDashboardProps) {
  const [transactions, setTransactions] = useState<any[]>(initialTransactions);
  const [selectedYear, setSelectedYear] = useState<string>("All");
  const [selectedMonth, setSelectedMonth] = useState<string>("All");

  // Get unique years from transactions for the filter dropdown
  const years = useMemo(() => {
    const yearsSet = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.transaction_date) {
        const yr = tx.transaction_date.split("-")[0];
        if (yr) yearsSet.add(yr);
      }
    });
    // Fallback to current year if empty
    if (yearsSet.size === 0) {
      yearsSet.add(new Date().getFullYear().toString());
    }
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Filter transactions for metrics and pie chart based on Month & Year
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (!tx.transaction_date) return true;
      const dateParts = tx.transaction_date.split("-");
      if (dateParts.length < 2) return true;
      const year = dateParts[0];
      const month = dateParts[1];

      const yearMatches = selectedYear === "All" || year === selectedYear;
      const monthMatches = selectedMonth === "All" || month === selectedMonth;

      return yearMatches && monthMatches;
    });
  }, [transactions, selectedYear, selectedMonth]);

  // Calculate metrics on the filtered subset of data
  const metrics = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let mrr = 0;

    filteredTransactions.forEach((tx) => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === "income") {
        totalIncome += amount;

        // MRR components
        if (tx.is_recurring) {
          if (tx.recurring_interval === "monthly") {
            mrr += amount;
          } else if (tx.recurring_interval === "quarterly") {
            mrr += amount / 3;
          } else if (tx.recurring_interval === "yearly") {
            mrr += amount / 12;
          }
        }
      } else {
        totalExpense += amount;
      }
    });

    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(0) : "0";

    return {
      totalIncome,
      totalExpense,
      netProfit,
      mrr,
      profitMargin,
    };
  }, [filteredTransactions]);

  // Calculate Recharts monthly comparison dataset ending at the selected date
  const monthlyReportData = useMemo(() => {
    const monthsListShort = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    let chartMonths: { key: string; label: string; yearMonth: string }[] = [];

    if (selectedYear !== "All" && selectedMonth === "All") {
      // Show all 12 months of that year
      const yr = parseInt(selectedYear);
      for (let m = 0; m < 12; m++) {
        const key = `${yr}-${String(m + 1).padStart(2, "0")}`;
        chartMonths.push({
          key,
          label: `${monthsListShort[m]} ${yr.toString().slice(-2)}`,
          yearMonth: key
        });
      }
    } else {
      // Determine end date
      let endYear = new Date().getFullYear();
      let endMonth = new Date().getMonth(); // 0-11
      
      if (selectedYear !== "All") {
        endYear = parseInt(selectedYear);
      }
      if (selectedMonth !== "All") {
        endMonth = parseInt(selectedMonth) - 1; // 0-11
      }
      
      // Window of 6 months ending at selection
      for (let i = 5; i >= 0; i--) {
        const d = new Date(endYear, endMonth - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        chartMonths.push({
          key,
          label: `${monthsListShort[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`,
          yearMonth: key
        });
      }
    }

    // Populate data from all transactions
    const reportData: Record<string, { income: number; expense: number; label: string }> = {};
    chartMonths.forEach((m) => {
      reportData[m.key] = { income: 0, expense: 0, label: m.label };
    });

    transactions.forEach((tx: any) => {
      if (!tx.transaction_date) return;
      const dateParts = tx.transaction_date.split("-");
      if (dateParts.length < 2) return;
      const key = `${dateParts[0]}-${dateParts[1]}`;
      
      if (reportData[key]) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === "income") {
          reportData[key].income += amt;
        } else {
          reportData[key].expense += amt;
        }
      }
    });

    return chartMonths.map((m) => ({
      month: m.label,
      income: reportData[m.key].income,
      expense: reportData[m.key].expense,
      profit: reportData[m.key].income - reportData[m.key].expense,
    }));
  }, [transactions, selectedYear, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Title Header with selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finans Paneli</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ajans gelirlerini, proje giderlerini, Aylık Tekrarlayan Geliri (MRR) ve net kâr marjlarını izleyin.
          </p>
        </div>

        {/* Month/Year Filters */}
        <div className="flex items-center gap-3 bg-card border border-border px-3 py-1.5 rounded-xl shrink-0 select-none relative z-30 shadow-md">
          <Calendar className="w-4 h-4 text-burgundy shrink-0" />
          
          {/* Year selector */}
          <CustomSelect
            value={selectedYear}
            onChange={setSelectedYear}
            options={[
              { value: "All", label: "Tüm Yıllar" },
              ...years.map((y) => ({ value: y, label: y })),
            ]}
          />

          <span className="w-px h-4 bg-border" />

          {/* Month selector */}
          <CustomSelect
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={MONTHS.map((m) => ({ value: m.val, label: m.label }))}
            align="right"
          />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Net Profit Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between h-[110px]">
          <div>
            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Net Kâr</span>
              <DollarSign className="w-4 h-4 text-burgundy" />
            </div>
            <div className="text-xl font-extrabold text-foreground mt-2 font-mono select-all">
              {formatCurrency(metrics.netProfit)}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground mt-1">
            <span className={metrics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {metrics.profitMargin}% marj
            </span>
            <span>kümülatif kâr</span>
          </div>
        </div>

        {/* MRR Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between h-[110px]">
          <div>
            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Aktif MRR</span>
              <RefreshCw className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-extrabold text-foreground mt-2 font-mono select-all">
              {formatCurrency(metrics.mrr)}
            </div>
          </div>
          <div className="text-[11px] font-semibold text-muted-foreground mt-1">
            Normalleştirilmiş aylık gelir
          </div>
        </div>

        {/* Total Income Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between h-[110px]">
          <div>
            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Toplam Gelir</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-extrabold text-foreground mt-2 font-mono select-all">
              {formatCurrency(metrics.totalIncome)}
            </div>
          </div>
          <div className="text-[11px] font-semibold text-muted-foreground mt-1">
            Toplam proje faturaları
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between h-[110px]">
          <div>
            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Toplam Gider</span>
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl font-extrabold text-foreground mt-2 font-mono select-all">
              {formatCurrency(metrics.totalExpense)}
            </div>
          </div>
          <div className="text-[11px] font-semibold text-muted-foreground mt-1">
            Yazılım, hosting, maaş toplamı
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <RevenueChart data={monthlyReportData} />
        </div>
        <div className="lg:col-span-2">
          <ExpenseChart transactions={filteredTransactions} />
        </div>
      </div>

      {/* Ledger Table */}
      <LedgerGrid
        transactions={filteredTransactions}
        setTransactions={setTransactions}
        clients={clients}
        projects={projects}
        userRole={userRole}
      />
    </div>
  );
}
