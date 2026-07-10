"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

interface RealtimePayload<T> {
  eventType: RealtimeEvent;
  new: T;
  old: Partial<T>;
}

interface UseRealtimeOptions<T> {
  /** The table to subscribe to */
  table: string;
  /** Optional filter column (e.g., "project_id") */
  filterColumn?: string;
  /** Optional filter value to match */
  filterValue?: string;
  /** Callback when a change is received */
  onInsert?: (record: T) => void;
  onUpdate?: (record: T, old: Partial<T>) => void;
  onDelete?: (old: Partial<T>) => void;
  /** Whether the subscription is enabled */
  enabled?: boolean;
}

/**
 * Generic hook for Supabase Realtime subscriptions.
 *
 * Subscribes to postgres_changes on a specific table with optional
 * column filtering. Automatically cleans up the channel on unmount.
 *
 * @example
 * ```tsx
 * useRealtime<Task>({
 *   table: "tasks",
 *   filterColumn: "project_id",
 *   filterValue: projectId,
 *   onInsert: (task) => addTaskToBoard(task),
 *   onUpdate: (task) => updateTaskOnBoard(task),
 *   onDelete: (old) => removeTaskFromBoard(old.id),
 * });
 * ```
 */
export function useRealtime<T extends Record<string, any>>({
  table,
  filterColumn,
  filterValue,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Use refs for callbacks to avoid re-subscribing on every render
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;
  onDeleteRef.current = onDelete;

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = filterValue
      ? `${table}:${filterColumn}:${filterValue}`
      : `${table}:all`;

    // Build the filter string for postgres_changes
    const filter = filterColumn && filterValue
      ? `${filterColumn}=eq.${filterValue}`
      : undefined;

    const channel = supabase
      .channel(channelName)
      .on<T>(
        "postgres_changes" as "system",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        } as Record<string, string>,
        (payload: unknown) => {
          const p = payload as RealtimePayload<T>;
          switch (p.eventType) {
            case "INSERT":
              onInsertRef.current?.(p.new);
              break;
            case "UPDATE":
              onUpdateRef.current?.(p.new, p.old);
              break;
            case "DELETE":
              onDeleteRef.current?.(p.old);
              break;
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, filterColumn, filterValue, enabled]);

  return channelRef;
}
