"use client";

import { Eye, Edit2, Trash2, MoreVertical } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";

interface ClientActionsProps {
  client: any;
  onEdit: (client: any) => void;
  onDelete: (id: string, name: string) => void;
  isPending?: boolean;
}

export function ClientActions({
  client,
  onEdit,
  onDelete,
  isPending,
}: ClientActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all inline-flex items-center"
          title="İşlemler"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent className="z-50 w-32" align="end">
          <DropdownMenuItem asChild>
            <Link
              href={`/clients/${client.id}`}
              className="flex items-center gap-2 w-full"
            >
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Detayları Gör</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onEdit(client)}
            className="flex items-center gap-2"
          >
            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Düzenle</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(client.id, client.name)}
            disabled={isPending}
            className="flex items-center gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Sil</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
