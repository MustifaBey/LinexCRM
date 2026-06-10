"use client";

import { useState, useTransition, useEffect } from "react";
import { createTask, updateTask, deleteTask } from "@/actions/tasks";
import { TASK_PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  X,
  Loader2,
  Trash2,
  Calendar,
  Clock,
  User,
  Tag,
  AlignLeft,
  Flag,
} from "lucide-react";
import type { Task, Profile } from "@/types/database";
import { toast } from "sonner";

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  columnId: string;
  task?: Task | null;
  teamMembers?: Profile[];
}

/**
 * Dialog for creating and editing Kanban task cards.
 * Includes fields for title, description, priority, assignee, dates, hours, and labels.
 */
export function TaskDialog({
  open,
  onClose,
  projectId,
  columnId,
  task,
  teamMembers = [],
}: TaskDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [labelsInput, setLabelsInput] = useState("");

  const isEditing = !!task;

  // Pre-fill form when editing
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setAssignedTo(task.assigned_to || "");
      setDueDate(task.due_date || "");
      setStartDate(task.start_date || "");
      setEstimatedHours(task.estimated_hours?.toString() || "");
      setLabelsInput(task.labels?.join(", ") || "");
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssignedTo("");
      setDueDate("");
      setStartDate("");
      setEstimatedHours("");
      setLabelsInput("");
    }
  }, [task, open]);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }
    if (title.trim().length > 100) {
      toast.error("Task title must be 100 characters or less");
      return;
    }
    if (description.trim().length > 500) {
      toast.error("Task description must be 500 characters or less");
      return;
    }

    const labels = labelsInput
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    startTransition(async () => {
      if (isEditing && task) {
        const result = await updateTask(task.id, projectId, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          assigned_to: assignedTo || null,
          due_date: dueDate || null,
          start_date: startDate || null,
          estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
          labels,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Task updated");
          onClose();
        }
      } else {
        const result = await createTask({
          project_id: projectId,
          column_id: columnId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          assigned_to: assignedTo || null,
          due_date: dueDate || null,
          start_date: startDate || null,
          estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
          labels,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Task created");
          onClose();
        }
      }
    });
  };

  const handleDelete = () => {
    if (!task) return;
    startTransition(async () => {
      const result = await deleteTask(task.id, projectId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Task deleted");
        onClose();
      }
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Task" : "Create Task"}
          </h2>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
              <Tag className="w-3.5 h-3.5" />
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              maxLength={100}
              className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              autoFocus
            />
            <span className="text-[10px] text-muted-foreground/60 mt-0.5 text-right block">
              {title.length}/100
            </span>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
              <AlignLeft className="w-3.5 h-3.5" />
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 rounded-xl bg-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
            <span className="text-[10px] text-muted-foreground/60 mt-0.5 text-right block">
              {description.length}/500
            </span>
          </div>

          {/* Priority & Assignee row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Flag className="w-3.5 h-3.5" />
                Priority
              </label>
              <div className="flex gap-1.5">
                {TASK_PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "flex-1 h-9 rounded-lg text-xs font-medium transition-all border",
                      priority === p.value
                        ? "border-current shadow-sm"
                        : "border-transparent bg-muted hover:bg-muted/80"
                    )}
                    style={{
                      color: priority === p.value ? p.color : undefined,
                      backgroundColor:
                        priority === p.value ? `${p.color}15` : undefined,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <User className="w-3.5 h-3.5" />
                Assignee
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all appearance-none"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name || member.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Calendar className="w-3.5 h-3.5" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Calendar className="w-3.5 h-3.5" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>
          </div>

          {/* Hours & Labels */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Clock className="w-3.5 h-3.5" />
                Est. Hours
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="0"
                className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Tag className="w-3.5 h-3.5" />
                Labels
              </label>
              <input
                value={labelsInput}
                onChange={(e) => setLabelsInput(e.target.value)}
                placeholder="design, frontend"
                className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isPending}
            className="h-9 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !title.trim()}
            className="h-9 px-5 rounded-xl gradient-burgundy text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isEditing ? (
              "Update Task"
            ) : (
              "Create Task"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
