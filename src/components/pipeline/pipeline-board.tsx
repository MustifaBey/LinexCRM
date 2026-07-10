"use client";

import { useState, useEffect } from "react";
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  type DragEndEvent, 
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor
} from "@dnd-kit/core";
import { PIPELINE_STATUSES } from "@/lib/constants";
import { updateClientPipelineStatus } from "@/actions/pipeline";
import type { Client } from "@/types/database";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Mail, Phone, Building2, User, ChevronRight, GripVertical } from "lucide-react";
import Link from "next/link";

interface PipelineBoardProps {
  initialClients: Client[];
}

export function PipelineBoard({ initialClients }: PipelineBoardProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [isMounted, setIsMounted] = useState(false);
  const [activeClient, setActiveClient] = useState<Client | null>(null);

  // Configure Sensors for responsive touch interactions
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });

  const sensors = useSensors(pointerSensor, touchSensor);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  if (!isMounted) {
    return (
      <div className="flex md:grid md:grid-cols-5 gap-4 overflow-x-auto pb-4 h-[600px] animate-pulse no-scrollbar">
        {PIPELINE_STATUSES.map((status) => (
          <div key={status.value} className="bg-card/20 border border-border/40 rounded-2xl p-4 space-y-4 w-[280px] shrink-0 md:w-auto">
            <div className="h-6 bg-muted rounded w-1/2" />
            <div className="h-32 bg-muted/40 rounded-xl" />
            <div className="h-32 bg-muted/40 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  const handleDragStart = (event: any) => {
    const client = event.active.data.current?.client;
    if (client) {
      setActiveClient(client);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveClient(null);

    if (!over) return;

    const clientId = active.id as string;
    const newStatus = over.id as string;

    const clientToMove = clients.find((c) => c.id === clientId);
    if (!clientToMove || clientToMove.pipeline_status === newStatus) return;

    // Optimistic Update
    const prevClients = [...clients];
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId ? { ...c, pipeline_status: newStatus as any } : c
      )
    );

    try {
      const res = await updateClientPipelineStatus(clientId, newStatus);
      if (res.error) {
        throw new Error(res.error);
      }
      toast.success(`${clientToMove.name} yeni aşamaya taşındı: ${PIPELINE_STATUSES.find(s => s.value === newStatus)?.label}`);
    } catch (err: any) {
      toast.error("Durum güncellenirken hata oluştu.");
      setClients(prevClients); // rollback
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex md:grid md:grid-cols-5 gap-4 overflow-x-auto pb-4 md:pb-0 h-full min-h-[600px] no-scrollbar">
        {PIPELINE_STATUSES.map((status) => {
          const stageClients = clients.filter((c) => c.pipeline_status === status.value);

          return (
            <PipelineColumn
              key={status.value}
              status={status}
              clients={stageClients}
            />
          );
        })}
      </div>

      {/* Drag Overlay for smooth card movement representation */}
      <DragOverlay>
        {activeClient ? <ClientCard client={activeClient} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

interface ColumnProps {
  status: typeof PIPELINE_STATUSES[number];
  clients: Client[];
}

function PipelineColumn({ status, clients }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.value,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border flex flex-col h-full bg-card/15 backdrop-blur-md transition-colors duration-200 w-[310px] shrink-0 md:w-auto",
        isOver
          ? "border-burgundy/60 bg-burgundy/5"
          : "border-border/60"
      )}
    >
      {/* Column Title Header */}
      <div className="p-4 border-b border-border/40 flex items-center justify-between bg-muted/10 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <h3 className="font-semibold text-sm text-foreground">{status.label}</h3>
        </div>
        <span className="text-xs bg-muted border border-border px-2 py-0.5 rounded-lg text-muted-foreground font-bold">
          {clients.length}
        </span>
      </div>

      {/* Cards List container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[550px] scrollbar-thin">
        {clients.length === 0 ? (
          <div className="h-24 border border-dashed border-border/50 rounded-xl flex items-center justify-center text-xs text-muted-foreground/60">
            Aday yok
          </div>
        ) : (
          clients.map((client) => (
            <DraggableCard key={client.id} client={client} />
          ))
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// DRAGGABLE CARD WRAPPER
// ────────────────────────────────────────────────────────────────────────
// Added touchAction none to prevent default mobile scroll gestures on drag trigger
function DraggableCard({ client }: { client: Client }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: client.id,
    data: { client },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        touchAction: "none",
      }
    : {
        touchAction: "none",
      };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-45")}
    >
      <ClientCard client={client} dragProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// CLIENT CARD COMPONENT
// ────────────────────────────────────────────────────────────────────────
function ClientCard({ client, dragProps, isOverlay }: { client: Client; dragProps?: any; isOverlay?: boolean }) {
  return (
    <div
      {...dragProps}
      className={cn(
        "rounded-xl bg-card border border-border p-3 space-y-2.5 shadow-sm group hover:border-burgundy/40 transition-colors relative select-none touch-none",
        isOverlay ? "border-burgundy ring-2 ring-burgundy/20 shadow-md cursor-grabbing" : "cursor-grab"
      )}
    >
      {/* Top drag handle / title row */}
      <div className="flex items-start justify-between gap-1.5">
        <Link 
          href={`/clients?id=${client.id}`} 
          className="font-medium text-xs text-foreground hover:text-burgundy transition-colors truncate"
          title={client.name}
          onClick={(e) => {
            if (isOverlay) e.preventDefault();
          }}
        >
          {client.name}
        </Link>
        
        {/* Grip Handle Indicator */}
        <div className="p-1 text-muted-foreground/60 group-hover:text-foreground rounded transition-colors">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Company Tag */}
      {client.company && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded border border-border/30 w-fit">
          <Building2 className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[140px]">{client.company}</span>
        </div>
      )}

      {/* Contact info row */}
      <div className="space-y-1 text-[10px] text-muted-foreground/80 pt-1.5 border-t border-border/40">
        {client.contact_email && (
          <div className="flex items-center gap-1.5 truncate">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{client.contact_email}</span>
          </div>
        )}
        {client.contact_phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 shrink-0" />
            <span>{client.contact_phone}</span>
          </div>
        )}
      </div>
    </div>
  );
}
