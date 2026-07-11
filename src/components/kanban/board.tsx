"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { KanbanColumn } from "./column";
import { KanbanCardOverlay } from "./card";
import dynamic from "next/dynamic";
const TaskDialog = dynamic(() => import("./task-dialog").then((mod) => mod.TaskDialog), {
  ssr: false,
});
import { useRealtime } from "@/hooks/use-realtime";
import { reorderTasks, moveTask } from "@/actions/tasks";
import type { KanbanColumn as KanbanColumnType, Task, Profile } from "@/types/database";
import { toast } from "sonner";

interface KanbanBoardProps {
  /** Initial data — columns with nested tasks */
  initialColumns: KanbanColumnType[];
  projectId: string;
  teamMembers?: Profile[];
}

/**
 * Main Kanban board component.
 *
 * Features:
 * - Drag-and-drop between columns and within columns using @dnd-kit
 * - Optimistic UI updates — card moves instantly on drag, DB write follows
 * - Supabase Realtime — other users' changes appear automatically
 * - Task creation/editing via dialog
 */
export function KanbanBoard({
  initialColumns,
  projectId,
  teamMembers = [],
}: KanbanBoardProps) {
  const [columns, setColumns] = useState<KanbanColumnType[]>(initialColumns);
  const [clonedColumns, setClonedColumns] = useState<KanbanColumnType[] | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync with props when initialColumns change (e.g., from server revalidation)
  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  // ─────────────────────────────────────────
  // DnD Sensors
  // ─────────────────────────────────────────
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5, // 5px movement required before drag starts
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150, // 150ms press to start dragging, so scrolling is not interrupted
      tolerance: 5, // 5px tolerance
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  // ─────────────────────────────────────────
  // Helper: find which column a task is in
  // ─────────────────────────────────────────
  const findColumnByTaskId = useCallback(
    (taskId: string): KanbanColumnType | undefined => {
      return columns.find((col) =>
        col.tasks?.some((t) => t.id === taskId)
      );
    },
    [columns]
  );

  // ─────────────────────────────────────────
  // DnD Event Handlers
  // ─────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = active.data?.current?.task as Task | undefined;
    if (task) {
      setActiveTask(task);
      setClonedColumns(columns); // Save snapshot for rollback
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeCol = findColumnByTaskId(activeId);
    const overCol = findColumnByTaskId(overId) || columns.find((col) => col.id === overId);

    if (!activeCol || !overCol) return;

    if (activeCol.id !== overCol.id) {
      setColumns((prev) => {
        const sourceCol = prev.find((col) => col.id === activeCol.id);
        const destCol = prev.find((col) => col.id === overCol.id);
        if (!sourceCol || !destCol) return prev;

        const sourceTasks = [...(sourceCol.tasks || [])];
        const destTasks = [...(destCol.tasks || [])];

        const activeIndex = sourceTasks.findIndex((t) => t.id === activeId);
        if (activeIndex === -1) return prev;

        const [movedTask] = sourceTasks.splice(activeIndex, 1);
        const updatedTask = { ...movedTask, column_id: overCol.id };

        // Determine where to insert in the target column
        const isOverTask = destCol.tasks?.some((t) => t.id === overId);
        let targetIndex = destTasks.length; // Default to end

        if (isOverTask) {
          targetIndex = destTasks.findIndex((t) => t.id === overId);
        } else {
          // If over is a Column, prepend (index 0)
          targetIndex = 0;
        }

        destTasks.splice(targetIndex, 0, updatedTask);

        // Adjust positions of tasks in both source and destination columns
        const updatedSourceTasks = sourceTasks.map((t, idx) => ({ ...t, position: idx }));
        const updatedDestTasks = destTasks.map((t, idx) => ({ ...t, position: idx }));

        return prev.map((col) => {
          if (col.id === sourceCol.id) {
            return { ...col, tasks: updatedSourceTasks };
          }
          if (col.id === destCol.id) {
            return { ...col, tasks: updatedDestTasks };
          }
          return col;
        });
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      if (clonedColumns) {
        setColumns(clonedColumns);
      }
      setClonedColumns(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const initialActiveCol = clonedColumns?.find((col) =>
      col.tasks?.some((t) => t.id === activeId)
    );
    if (!initialActiveCol) {
      setClonedColumns(null);
      return;
    }

    const currentActiveCol = findColumnByTaskId(activeId);
    if (!currentActiveCol) {
      setClonedColumns(null);
      return;
    }

    const isSameColumn = initialActiveCol.id === currentActiveCol.id;

    if (isSameColumn) {
      // Rule A (Task over Task - Same Column): Reorder array locally, then call reorderTasks DB action.
      const tasks = currentActiveCol.tasks || [];
      const oldIndex = tasks.findIndex((t) => t.id === activeId);
      const newIndex = tasks.findIndex((t) => t.id === overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
        const nextColumns = columns.map((col) => {
          if (col.id === currentActiveCol.id) {
            return {
              ...col,
              tasks: reorderedTasks.map((t, idx) => ({ ...t, position: idx })),
            };
          }
          return col;
        });
        setColumns(nextColumns);

        const taskUpdates = reorderedTasks.map((t, idx) => ({
          id: t.id,
          position: idx,
          column_id: currentActiveCol.id,
        }));

        try {
          const result = await reorderTasks(taskUpdates, projectId);
          if (result && "error" in result && result.error) {
            toast.error("Değişiklikler kaydedilemedi: " + result.error);
            if (clonedColumns) setColumns(clonedColumns);
          }
        } catch (err: any) {
          toast.error("Kaydetme sırasında hata oluştu: " + err.message);
          if (clonedColumns) setColumns(clonedColumns);
        }
      }
    } else {
      // Cross-column drop
      const isOverColumn = columns.some((col) => col.id === overId);

      if (isOverColumn) {
        // Rule C (Task over Column): Drop on column directly. Call moveTask with position 0.
        try {
          const result = await moveTask(activeId, currentActiveCol.id, 0, projectId);
          if (result && "error" in result && result.error) {
            toast.error("Değişiklikler kaydedilemedi: " + result.error);
            if (clonedColumns) setColumns(clonedColumns);
          }
        } catch (err: any) {
          toast.error("Kaydetme sırasında hata oluştu: " + err.message);
          if (clonedColumns) setColumns(clonedColumns);
        }
      } else {
        // Rule B (Task over Task - Different Column): Call moveTask with calculated index.
        const targetTasks = currentActiveCol.tasks || [];
        const newIndex = targetTasks.findIndex((t) => t.id === activeId);
        const finalPosition = newIndex !== -1 ? newIndex : 0;

        try {
          const result = await moveTask(activeId, currentActiveCol.id, finalPosition, projectId);
          if (result && "error" in result && result.error) {
            toast.error("Değişiklikler kaydedilemedi: " + result.error);
            if (clonedColumns) setColumns(clonedColumns);
          }
        } catch (err: any) {
          toast.error("Kaydetme sırasında hata oluştu: " + err.message);
          if (clonedColumns) setColumns(clonedColumns);
        }
      }
    }

    setClonedColumns(null);
  };

  // ─────────────────────────────────────────
  // Supabase Realtime Subscription
  // ─────────────────────────────────────────
  useRealtime<Task>({
    table: "tasks",
    filterColumn: "project_id",
    filterValue: projectId,
    onInsert: (newTask) => {
      setColumns((prev) =>
        prev.map((col) => {
          if (col.id !== newTask.column_id) return col;
          // Don't add if already exists (from optimistic update)
          if (col.tasks?.some((t) => t.id === newTask.id)) return col;
          return {
            ...col,
            tasks: [...(col.tasks || []), newTask].sort(
              (a, b) => a.position - b.position
            ),
          };
        })
      );
    },
    onUpdate: (updatedTask, oldTask) => {
      setColumns((prev) => {
        // If column changed, move between columns
        if (oldTask.column_id && oldTask.column_id !== updatedTask.column_id) {
          return prev.map((col) => {
            if (col.id === oldTask.column_id) {
              return {
                ...col,
                tasks: (col.tasks || []).filter((t) => t.id !== updatedTask.id),
              };
            }
            if (col.id === updatedTask.column_id) {
              const exists = col.tasks?.some((t) => t.id === updatedTask.id);
              const tasks = exists
                ? (col.tasks || []).map((t) =>
                    t.id === updatedTask.id ? { ...t, ...updatedTask } : t
                  )
                : [...(col.tasks || []), updatedTask];
              return {
                ...col,
                tasks: tasks.sort((a, b) => a.position - b.position),
              };
            }
            return col;
          });
        }

        // Same column update
        return prev.map((col) => ({
          ...col,
          tasks: (col.tasks || [])
            .map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
            .sort((a, b) => a.position - b.position),
        }));
      });
    },
    onDelete: (oldTask) => {
      if (!oldTask.id) return;
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: (col.tasks || []).filter((t) => t.id !== oldTask.id),
        }))
      );
    },
  });

  // ─────────────────────────────────────────
  // Task Dialog handlers
  // ─────────────────────────────────────────
  const handleAddTask = (columnId: string) => {
    setEditingTask(null);
    setActiveColumnId(columnId);
    setDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setActiveColumnId(task.column_id);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingTask(null);
    setActiveColumnId("");
  };

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  if (!isMounted) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
        {columns.map((column) => (
          <div
            key={column.id}
            className="w-80 shrink-0 bg-card/30 border border-border/60 rounded-2xl p-4 flex flex-col h-[calc(100vh-250px)]"
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={column.tasks || []}
              onEditTask={handleEditTask}
              onAddTask={handleAddTask}
            />
          ))}
        </div>

        {/* Drag overlay — renders the dragged card above everything */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? <KanbanCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Task create/edit dialog */}
      <TaskDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        projectId={projectId}
        columnId={activeColumnId}
        task={editingTask}
        teamMembers={teamMembers}
      />
    </>
  );
}
