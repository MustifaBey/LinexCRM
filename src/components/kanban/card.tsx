"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, formatDate } from "@/lib/utils";
import { TASK_PRIORITIES } from "@/lib/constants";
import {
  GripVertical,
  Calendar,
  Clock,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";
import type { Task } from "@/types/database";

interface KanbanCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  isDragOverlay?: boolean;
}

/**
 * Draggable Kanban task card.
 * Renders title, priority badge, assignee avatar, due date, and labels.
 * Uses @dnd-kit/sortable for smooth drag interactions.
 */
export function KanbanCard({ task, onEdit, isDragOverlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = TASK_PRIORITIES.find((p) => p.value === task.priority);

  return (
    <div
      id={task.id}
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl bg-card border border-border p-3.5 cursor-pointer transition-all duration-200",
        "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
        isDragging && "opacity-40 rotate-2 scale-105",
        isDragOverlay &&
          "shadow-2xl shadow-primary/20 border-primary/40 rotate-1 scale-105 cursor-grabbing"
      )}
      onClick={() => onEdit(task)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/15 text-primary"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h4 className="text-sm font-medium text-foreground leading-snug pr-6 line-clamp-2 break-words">
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 break-words">
          {task.description}
        </p>
      )}

      {/* Bottom metadata row */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50">
        <div className="flex items-center gap-2">
          {/* Priority badge */}
          {priority && (
            <span
              className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: priority.color }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: priority.color }}
              />
              {priority.label}
            </span>
          )}

          {/* Due date */}
          {task.due_date && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {formatDate(task.due_date)}
            </span>
          )}
        </div>

        {/* Assignee avatar */}
        <div className="flex items-center gap-1.5">
          {task.estimated_hours && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {task.estimated_hours}h
            </span>
          )}

          {task.assignee && (
            <div
              className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary ring-2 ring-card"
              title={task.assignee.full_name || task.assignee.email}
            >
              {(task.assignee.full_name || task.assignee.email || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Lightweight card component used as the drag overlay.
 * Shows a lifted, shadowed version of the card while dragging.
 */
export function KanbanCardOverlay({ task }: { task: Task }) {
  return <KanbanCard task={task} onEdit={() => {}} isDragOverlay />;
}
