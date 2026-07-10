"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import type { VaultCredential, Client } from "@/types/database";
import { deleteVaultCredential } from "@/actions/vault";
import { CredentialDialog } from "./credential-dialog";
import { toast } from "sonner";
import {
  Key,
  Copy,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  ExternalLink,
  Lock,
  Unlock,
  ShieldCheck,
  Building,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { EmptyState } from "../shared/empty-state";
import { cn } from "@/lib/utils";

interface CredentialTableProps {
  initialCredentials: any[];
  clients: Client[];
}

export function CredentialTable({
  initialCredentials,
  clients,
}: CredentialTableProps) {
  const [credentials, setCredentials] = useState<any[]>(initialCredentials);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const query = params.get("search");
      if (query) {
        setSearch(query);
      }
    }
  }, []);
  
  // Decrypted states stored by credentialId_field (e.g. "cred1_username", "cred1_password")
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [decryptingIds, setDecryptingIds] = useState<Record<string, boolean>>({});

  // Dialog / Edit states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();

  // Decryption on demand
  const handleReveal = async (credId: string, field: "username" | "password" | "notes", ciphertext: string) => {
    const key = `${credId}_${field}`;

    // If already decrypted and shown, we can toggle it off locally (clear from state)
    if (decryptedValues[key]) {
      setDecryptedValues((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      return;
    }

    setDecryptingIds((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await fetch("/api/vault/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ciphertext }),
      });
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
      } else {
        setDecryptedValues((prev) => ({ ...prev, [key]: data.decrypted }));
      }
    } catch (err) {
      toast.error("Decryption failed. Please try again.");
    } finally {
      setDecryptingIds((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Copy to clipboard with Check Icon toast
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`, {
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this credential?")) return;

    startTransition(async () => {
      const result = await deleteVaultCredential(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Credential deleted from vault");
        setCredentials((prev) => prev.filter((c) => c.id !== id));
      }
    });
  };

  // Group credentials by client
  const groupedCredentials = useMemo(() => {
    // Apply search filter first
    const filtered = credentials.filter((c) => {
      const q = search.toLowerCase();
      return (
        c.label.toLowerCase().includes(q) ||
        c.client?.name.toLowerCase().includes(q) ||
        c.credential_type.toLowerCase().includes(q)
      );
    });

    const groups: Record<string, any[]> = {};
    filtered.forEach((cred) => {
      const clientName = cred.client?.name || "Unassigned Client";
      if (!groups[clientName]) {
        groups[clientName] = [];
      }
      groups[clientName].push(cred);
    });

    return groups;
  }, [credentials, search]);

  const hasCredentials = Object.keys(groupedCredentials).length > 0;

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/40 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
        <div className="relative flex-1 w-full sm:w-64 max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search credential labels, clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        <button
          onClick={() => {
            setEditingCred(null);
            setDialogOpen(true);
          }}
          className="h-10 px-4 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0 shadow-lg shadow-burgundy/10 w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add Credential</span>
        </button>
      </div>

      {/* Grouped Table List */}
      {!hasCredentials ? (
        <EmptyState
          title="No credentials secured"
          description="Secure your server keys, WordPress admins, or social details in the encrypted vault."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCredentials).map(([clientName, items]) => (
            <div key={clientName} className="space-y-3">
              {/* Client Group Header */}
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1.5 select-none">
                <Building className="w-3.5 h-3.5 text-burgundy" />
                <span>{clientName}</span>
                <span className="text-[10px] bg-muted py-0.5 px-2 rounded-md font-mono text-foreground font-semibold">
                  {items.length} records
                </span>
              </div>

              {/* Client Credentials Table */}
              <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/15 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                        <th className="px-5 py-3">Label</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Username</th>
                        <th className="px-5 py-3">Password</th>
                        <th className="px-5 py-3">Notes</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 text-xs">
                      {items.map((cred) => {
                        const userKey = `${cred.id}_username`;
                        const passKey = `${cred.id}_password`;
                        const notesKey = `${cred.id}_notes`;

                        const decryptedUser = decryptedValues[userKey];
                        const decryptedPass = decryptedValues[passKey];
                        const decryptedNotes = decryptedValues[notesKey];

                        const isDecryptingUser = decryptingIds[userKey];
                        const isDecryptingPass = decryptingIds[passKey];
                        const isDecryptingNotes = decryptingIds[notesKey];

                        return (
                          <tr
                            key={cred.id}
                            className="hover:bg-muted/10 transition-colors group"
                          >
                            {/* Label / url */}
                            <td className="px-5 py-4 font-semibold text-foreground max-w-[150px] truncate">
                              <div>{cred.label}</div>
                              {cred.url && (
                                <a
                                  href={cred.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-muted-foreground hover:text-burgundy flex items-center gap-0.5 mt-0.5 truncate select-all"
                                >
                                  <span>{cred.url}</span>
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                </a>
                              )}
                            </td>

                            {/* Credential Type badge */}
                            <td className="px-5 py-4">
                              <span className="bg-muted px-2 py-0.5 rounded text-[10px] uppercase font-bold text-foreground/80 border border-border/40 tracking-wider">
                                {cred.credential_type}
                              </span>
                            </td>

                            {/* Username with reveal/copy */}
                            <td className="px-5 py-4 font-medium max-w-[180px] truncate">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("font-mono truncate select-all", !decryptedUser && "text-muted-foreground/60 select-none")}>
                                  {decryptedUser ? decryptedUser : "••••••••"}
                                </span>
                                
                                <button
                                  onClick={() => handleReveal(cred.id, "username", cred.username_encrypted)}
                                  disabled={isDecryptingUser}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground"
                                  title="Reveal username"
                                >
                                  {isDecryptingUser ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : decryptedUser ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {decryptedUser && (
                                  <button
                                    onClick={() => handleCopy(decryptedUser, "Username")}
                                    className="p-1 rounded text-muted-foreground hover:text-burgundy"
                                    title="Copy username"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Password with reveal/copy */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("font-mono truncate select-all", !decryptedPass && "text-muted-foreground/60 select-none")}>
                                  {decryptedPass ? decryptedPass : "••••••••••••"}
                                </span>

                                <button
                                  onClick={() => handleReveal(cred.id, "password", cred.password_encrypted)}
                                  disabled={isDecryptingPass}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground"
                                  title="Reveal password"
                                >
                                  {isDecryptingPass ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : decryptedPass ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {decryptedPass && (
                                  <button
                                    onClick={() => handleCopy(decryptedPass, "Password")}
                                    className="p-1 rounded text-muted-foreground hover:text-burgundy"
                                    title="Copy password"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Notes with reveal/copy */}
                            <td className="px-5 py-4 max-w-[200px] truncate">
                              {cred.notes_encrypted ? (
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("truncate select-all", !decryptedNotes && "text-muted-foreground/60 select-none")}>
                                    {decryptedNotes ? decryptedNotes : "••••••••"}
                                  </span>
                                  
                                  <button
                                    onClick={() => handleReveal(cred.id, "notes", cred.notes_encrypted)}
                                    disabled={isDecryptingNotes}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                                    title="Reveal notes"
                                  >
                                    {isDecryptingNotes ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : decryptedNotes ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  {decryptedNotes && (
                                    <button
                                      onClick={() => handleCopy(decryptedNotes, "Notes")}
                                      className="p-1 rounded text-muted-foreground hover:text-burgundy"
                                      title="Copy notes"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>

                            {/* Actions column */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingCred(cred);
                                    setDialogOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                                  title="Edit credentials"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(cred.id)}
                                  className="p-1.5 rounded-lg border border-border bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                                  title="Delete credentials"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog modal */}
      <CredentialDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        clients={clients}
        credential={editingCred}
        onSaveSuccess={(savedRecord) => {
          // Re-update state locally
          setCredentials((prev) => {
            const index = prev.findIndex((c) => c.id === savedRecord.id);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = savedRecord;
              return updated;
            }
            return [savedRecord, ...prev];
          });
        }}
      />
    </div>
  );
}
