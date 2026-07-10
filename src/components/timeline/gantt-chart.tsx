"use client";

import { useMemo } from "react";
import { cn, formatDate } from "@/lib/utils";
import { TASK_PRIORITIES } from "@/lib/constants";
import {
  differenceInDays,
  addDays,
  startOfDay,
  format,
  isWeekend,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns";
import type { Task, KanbanColumn } from "@/types/database";

interface GanttChartProps {
  columns: KanbanColumn[];
  projectStartDate?: string | null;
  projectEndDate?: string | null;
}

/**
 * Gantt-style timeline view for project tasks.
 *
 * Renders a horizontal bar chart with:
 * - Date axis header with day numbers and weekend highlighting
 * - Task rows with colored bars showing start → due date ranges
 * - Priority color coding
 * - Column grouping
 */
export function GanttChart({
  columns,
  projectStartDate,
  projectEndDate,
}: GanttChartProps) {
  // ─────────────────────────────────────────
  // Compute all tasks and timeline range
  // ─────────────────────────────────────────
  const allTasks = useMemo(() => {
    return columns.flatMap(
      (col) =>
        col.tasks?.map((t) => ({
          ...t,
          columnTitle: col.title,
          columnColor: col.color,
        })) || []
    );
  }, [columns]);

  // Filter tasks that have at least a start or due date
  const scheduledTasks = useMemo(() => {
    return allTasks.filter((t) => t.start_date || t.due_date);
  }, [allTasks]);

  // Calculate the timeline range
  const { timelineStart, timelineEnd, totalDays, days } = useMemo(() => {
    const dates: Date[] = [];

    scheduledTasks.forEach((t) => {
      if (t.start_date) dates.push(new Date(t.start_date));
      if (t.due_date) dates.push(new Date(t.due_date));
    });

    if (projectStartDate) dates.push(new Date(projectStartDate));
    if (projectEndDate) dates.push(new Date(projectEndDate));

    if (dates.length === 0) {
      // Default to 30-day window starting today
      const today = startOfDay(new Date());
      return {
        timelineStart: today,
        timelineEnd: addDays(today, 30),
        totalDays: 30,
        days: eachDayOfInterval({
          start: today,
          end: addDays(today, 30),
        }),
      };
    }

    const minDate = startOfWeek(
      new Date(Math.min(...dates.map((d) => d.getTime())))
    );
    const maxDate = addDays(
      new Date(Math.max(...dates.map((d) => d.getTime()))),
      7
    );

    const total = differenceInDays(maxDate, minDate) + 1;

    return {
      timelineStart: minDate,
      timelineEnd: maxDate,
      totalDays: total,
      days: eachDayOfInterval({ start: minDate, end: maxDate }),
    };
  }, [scheduledTasks, projectStartDate, projectEndDate]);

  // ─────────────────────────────────────────
  // Helper: calculate bar position and width
  // ─────────────────────────────────────────
  const getBarStyle = (startDate: string | null, endDate: string | null) => {
    const start = startDate
      ? startOfDay(new Date(startDate))
      : endDate
        ? startOfDay(new Date(endDate))
        : timelineStart;
    const end = endDate
      ? startOfDay(new Date(endDate))
      : startDate
        ? addDays(startOfDay(new Date(startDate)), 1)
        : addDays(timelineStart, 1);

    const leftDays = differenceInDays(start, timelineStart);
    const widthDays = Math.max(differenceInDays(end, start) + 1, 1);

    const left = (leftDays / totalDays) * 100;
    const width = (widthDays / totalDays) * 100;

    return {
      left: `${Math.max(left, 0)}%`,
      width: `${Math.min(width, 100 - Math.max(left, 0))}%`,
    };
  };

  // ─────────────────────────────────────────
  // Empty state
  // ─────────────────────────────────────────
  if (scheduledTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <svg
            className="w-7 h-7 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold">No Scheduled Tasks</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Add start and due dates to your tasks in the Kanban board to see them
          on the timeline.
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // Cell width for the day columns
  // ─────────────────────────────────────────
  const dayWidth = Math.max(36, 900 / totalDays);

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="min-w-fit"
          style={{ width: `${Math.max(days.length * dayWidth, 900)}px` }}
        >
          {/* ─── Date Header ─────────────────────── */}
          <div className="sticky top-0 z-10 bg-card border-b border-border">
            {/* Month row */}
            <div className="flex h-8 border-b border-border/50">
              <div className="w-[240px] min-w-[240px] flex-shrink-0 px-4 flex items-center">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Task
                </span>
              </div>
              <div className="flex-1 flex">
                {days.map((day, i) => {
                  // Only show month label on the first of each month or first day
                  const showMonth =
                    i === 0 || format(day, "MMM") !== format(days[i - 1], "MMM");
                  return showMonth ? (
                    <div
                      key={`month-${i}`}
                      className="text-xs font-semibold text-foreground/70 flex items-center px-1"
                      style={{ width: `${dayWidth}px`, minWidth: `${dayWidth}px` }}
                    >
                      {format(day, "MMM yyyy")}
                    </div>
                  ) : (
                    <div
                      key={`month-${i}`}
                      style={{ width: `${dayWidth}px`, minWidth: `${dayWidth}px` }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Day number row */}
            <div className="flex h-7">
              <div className="w-[240px] min-w-[240px] flex-shrink-0" />
              <div className="flex-1 flex">
                {days.map((day, i) => {
                  const weekend = isWeekend(day);
                  const isToday =
                    format(day, "yyyy-MM-dd") ===
                    format(new Date(), "yyyy-MM-dd");
                  return (
                    <div
                      key={`day-${i}`}
                      className={cn(
                        "flex items-center justify-center text-[10px] border-l border-border/30",
                        weekend && "bg-muted/30 text-muted-foreground/50",
                        isToday &&
                          "bg-primary/10 text-primary font-bold"
                      )}
                      style={{ width: `${dayWidth}px`, minWidth: `${dayWidth}px` }}
                    >
                      {format(day, "d")}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── Task Rows ───────────────────────── */}
          <div>
            {columns.map((column) => {
              const colTasks = scheduledTasks.filter(
                (t) => t.column_id === column.id
              );
              if (colTasks.length === 0) return null;

              return (
                <div key={column.id}>
                  {/* Column group header */}
                  <div className="flex h-8 bg-surface/30 border-b border-border/50">
                    <div className="w-[240px] min-w-[240px] flex-shrink-0 px-4 flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: column.color || "#800020",
                        }}
                      />
                      <span className="text-xs font-semibold text-foreground/70">
                        {column.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({colTasks.length})
                      </span>
                    </div>
                    <div className="flex-1" />
                  </div>

                  {/* Task bars */}
                  {colTasks.map((task) => {
                    const barStyle = getBarStyle(task.start_date, task.due_date);
                    const priority = TASK_PRIORITIES.find(
                      (p) => p.value === task.priority
                    );

                    return (
                      <div
                        key={task.id}
                        className="flex h-10 border-b border-border/30 hover:bg-muted/20 transition-colors group"
                      >
                        {/* Task name */}
                        <div className="w-[240px] min-w-[240px] flex-shrink-0 px-4 flex items-center gap-2 overflow-hidden">
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: priority?.color || "#6b7280",
                            }}
                          />
                          <span className="text-xs text-foreground truncate">
                            {task.title}
                          </span>
                          {task.assignee && (
                            <span className="text-[9px] text-muted-foreground flex-shrink-0">
                              — {task.assignee.full_name || task.assignee.email}
                            </span>
                          )}
                        </div>

                        {/* Timeline area with bar */}
                        <div className="flex-1 relative">
                          {/* Background day columns */}
                          <div className="absolute inset-0 flex">
                            {days.map((day, i) => (
                              <div
                                key={`bg-${i}`}
                                className={cn(
                                  "border-l border-border/20",
                                  isWeekend(day) && "bg-muted/15"
                                )}
                                style={{
                                  width: `${dayWidth}px`,
                                  minWidth: `${dayWidth}px`,
                                }}
                              />
                            ))}
                          </div>

                          {/* Task bar */}
                          <div
                            className="absolute top-1.5 h-7 rounded-lg flex items-center px-2 transition-all duration-200 group-hover:shadow-md cursor-pointer"
                            style={{
                              ...barStyle,
                              backgroundColor: `${priority?.color || "#800020"}30`,
                              borderLeft: `3px solid ${priority?.color || "#800020"}`,
                            }}
                          >
                            <span
                              className="text-[10px] font-medium truncate"
                              style={{ color: priority?.color || "#800020" }}
                            >
                              {task.title}
                            </span>
                          </div>

                          {/* Today indicator line */}
                          {days.some(
                            (d) =>
                              format(d, "yyyy-MM-dd") ===
                              format(new Date(), "yyyy-MM-dd")
                          ) && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-10"
                              style={{
                                left: `${(differenceInDays(startOfDay(new Date()), timelineStart) / totalDays) * 100}%`,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
