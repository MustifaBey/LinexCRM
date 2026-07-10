"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PostDialog } from "./post-dialog";
import type { ContentPost, Project } from "@/types/database";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  initialPosts: any[];
  projects: Project[];
  currentMonth: number;
  currentYear: number;
}

const WEEKDAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

const STATUS_MAP = {
  draft: { label: "Taslak", bg: "bg-zinc-850/80 text-zinc-300 border-zinc-700/60" },
  pending: { label: "İncelemede", bg: "bg-amber-950/40 text-amber-400 border-amber-800/50" },
  published: { label: "Yayınlandı", bg: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50" },
};

function getLocalDateString(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function CalendarView({
  initialPosts,
  projects,
  currentMonth,
  currentYear,
}: CalendarViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const posts = initialPosts;

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Month navigation helpers
  const handleMonthChange = (direction: "prev" | "next") => {
    let nextMonth = currentMonth;
    let nextYear = currentYear;

    if (direction === "prev") {
      if (currentMonth === 1) {
        nextMonth = 12;
        nextYear = currentYear - 1;
      } else {
        nextMonth = currentMonth - 1;
      }
    } else {
      if (currentMonth === 12) {
        nextMonth = 1;
        nextYear = currentYear + 1;
      } else {
        nextMonth = currentMonth + 1;
      }
    }

    router.push(`${pathname}?month=${nextMonth}&year=${nextYear}`);
  };

  const handleToday = () => {
    const today = new Date();
    router.push(`${pathname}?month=${today.getMonth() + 1}&year=${today.getFullYear()}`);
  };

  // Generate monthly days list
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayIndex = (new Date(currentYear, currentMonth - 1, 1).getDay() + 6) % 7; // Mon=0, Sun=6

  const calendarCells: { date: Date | null; isCurrentMonth: boolean; dayNumber: number }[] = [];

  // Add empty/prev month padding cells
  const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const daysInPrevMonth = new Date(prevMonthYear, prevMonth, 0).getDate();

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({
      date: new Date(prevMonthYear, prevMonth - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
      dayNumber: daysInPrevMonth - i,
    });
  }

  // Add current month cells
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      date: new Date(currentYear, currentMonth - 1, i),
      isCurrentMonth: true,
      dayNumber: i,
    });
  }

  // Add next month padding cells to complete 6 full weeks grid (42 cells)
  const remainingCells = 42 - calendarCells.length;
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      date: new Date(nextMonthYear, nextMonth - 1, i),
      isCurrentMonth: false,
      dayNumber: i,
    });
  }

  const handleCellClick = (date: Date) => {
    setSelectedPost(null);
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const handlePostClick = (e: React.MouseEvent, post: any) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPost(post);
    setSelectedDate(null);
    setDialogOpen(true);
  };

  const allPostsToRender = Array.isArray(posts) ? posts : [];

  return (
    <div className="space-y-6">
      {/* Calendar Header / Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/40 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
        
        {/* Month selector title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleMonthChange("prev")}
            className="p-2 rounded-xl bg-input hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-all"
            title="Önceki Ay"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold tracking-tight text-foreground min-w-[150px] text-center">
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </h2>
          <button
            onClick={() => handleMonthChange("next")}
            className="p-2 rounded-xl bg-input hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-all"
            title="Sonraki Ay"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleToday}
            className="h-10 px-4 rounded-xl bg-input border border-border hover:bg-muted text-sm font-medium transition-all"
          >
            Bugün
          </button>
          
          <button
            onClick={() => {
              setSelectedPost(null);
              setSelectedDate(new Date());
              setDialogOpen(true);
            }}
            className="h-10 px-4 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-burgundy/10"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni İçerik</span>
          </button>
        </div>
      </div>

      {/* Grid Calendar Layout */}
      <div className="rounded-2xl border border-border/70 overflow-hidden bg-card/25 backdrop-blur-md">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border/75 bg-muted/30">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2.5 md:py-3 text-center text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/40 last:border-r-0"
            >
              <span className="hidden md:inline">{day}</span>
              <span className="inline md:hidden">
                {day === "Pazartesi" ? "Pzt" :
                 day === "Salı" ? "Sal" :
                 day === "Çarşamba" ? "Çar" :
                 day === "Perşembe" ? "Per" :
                 day === "Cuma" ? "Cum" :
                 day === "Cumartesi" ? "Cmt" : "Paz"}
              </span>
            </div>
          ))}
        </div>

        {/* Days grid cells */}
        <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-border/40">
          {calendarCells.map((cell, index) => {
            const cellDate = cell.date;
            const cellYear = cellDate ? cellDate.getFullYear() : 0;
            const cellMonth = cellDate ? String(cellDate.getMonth() + 1).padStart(2, '0') : "00";
            const cellDay = cellDate ? String(cellDate.getDate()).padStart(2, '0') : "00";
            const cellDateStr = `${cellYear}-${cellMonth}-${cellDay}`;

            const dayPosts = allPostsToRender.filter((post) => {
              if (!post.publish_date) return false;
              const postDateStr = post.publish_date.includes('T') ? post.publish_date.split('T')[0] : post.publish_date;
              return postDateStr === cellDateStr;
            });

            const isToday = getLocalDateString(new Date()) === cellDateStr;

            return (
              <div
                key={index}
                onClick={() => cell.date && handleCellClick(cell.date)}
                className={cn(
                  "min-h-[75px] md:min-h-[120px] p-1.5 md:p-2 flex flex-col gap-1 md:gap-1.5 transition-colors cursor-pointer hover:bg-muted/10 group relative select-none",
                  cell.isCurrentMonth ? "bg-card/20" : "bg-muted/5 text-muted-foreground/50"
                )}
              >
                {/* Cell Number Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-[10px] md:text-xs font-bold rounded-lg transition-colors",
                      isToday
                        ? "bg-burgundy text-white shadow-md shadow-burgundy/20"
                        : cell.isCurrentMonth
                        ? "text-foreground group-hover:bg-muted"
                        : "text-muted-foreground"
                    )}
                  >
                    {cell.dayNumber}
                  </span>
                  
                  {/* Hover Cell Action icon (desktop only) */}
                  <span className="hidden md:inline-flex opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-burgundy font-bold items-center gap-0.5">
                    <Plus className="w-3 h-3" /> Ekle
                  </span>
                </div>

                {/* Day Posts List */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 md:pr-1.5 max-h-[45px] md:max-h-[85px] scrollbar-thin">
                  {dayPosts.map((post) => {
                    const statusConfig = STATUS_MAP[post.status as keyof typeof STATUS_MAP] || STATUS_MAP.draft;
                    
                    return (
                      <div
                        key={post.id}
                        onClick={(e) => handlePostClick(e, post)}
                        className={cn(
                          "px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg border text-[9px] md:text-[10px] font-medium transition-all hover:scale-[1.02] flex flex-col gap-0.5 shadow-sm truncate",
                          statusConfig.bg
                        )}
                        title={post.content}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold truncate text-foreground text-[8px] md:text-[10px]">
                            {post.project?.name || "Genel"}
                          </span>
                          <span className="hidden sm:inline text-[8px] opacity-75">
                            {new Date(post.publish_date).toLocaleTimeString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        <p className="truncate opacity-90 leading-normal text-[8px] md:text-[9px]">{post.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dialog modal control */}
      <PostDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        post={selectedPost}
        projects={projects}
        initialDate={selectedDate}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
