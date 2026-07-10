"use client";

import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./card";
import { Plus } from "lucide-react";
import type { KanbanColumn as KanbanColumnType } from "@/types/database";
import type { Task } from "@/types/database";

interface KanbanColumnProps {
  column: KanbanColumnType;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onAddTask: (columnId: string) => void;
}

/**
 * Droppable Kanban column.
 * Contains a header with title, task count, and color indicator.
 * Wraps task cards in a SortableContext for drag-and-drop ordering.
 */
export const KanbanColumn = memo(function KanbanColumn({
  column,
  tasks,
  onEditTask,
  onAddTask,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "column",
      column,
    },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      className={cn(
        "flex flex-col w-[300px] min-w-[300px] rounded-2xl bg-surface/50 border border-border/50 transition-all duration-300",
        isOver && "border-primary/40 bg-primary/5 shadow-lg shadow-primary/5"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          {/* Color indicator dot */}
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: column.color || "#800020" }}
          />
          <h3 className="text-sm font-semibold text-foreground">
            {column.title}
          </h3>
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => onAddTask(column.id)}
          className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label={`Add task to ${column.title}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-full"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} onEdit={onEditTask} />
          ))}
        </SortableContext>

        {/* Empty column state */}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 text-center">
            <p className="text-xs text-muted-foreground/60">
              Henüz görev yok
            </p>
            <button
              onClick={() => onAddTask(column.id)}
              className="mt-1.5 text-xs text-primary/70 hover:text-primary transition-colors"
            >
              + Görev ekle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.column.id === nextProps.column.id &&
    prevProps.column.title === nextProps.column.title &&
    prevProps.column.color === nextProps.column.color &&
    prevProps.tasks.length === nextProps.tasks.length &&
    prevProps.tasks.map(t => t.id).join(",") === nextProps.tasks.map(t => t.id).join(",") &&
    prevProps.tasks.map(t => t.updated_at).join(",") === nextProps.tasks.map(t => t.updated_at).join(",")
  );
});
