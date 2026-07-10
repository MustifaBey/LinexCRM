"use client";

import { useState, useTransition, useEffect } from "react";
import type { Client, CredentialType } from "@/types/database";
import { createVaultCredential, updateVaultCredential } from "@/actions/vault";
import { CREDENTIAL_TYPES } from "@/lib/constants";
import { toast } from "sonner";
import {
  X,
  ShieldAlert,
  Loader2,
  Key,
  Globe,
  User,
  Eye,
  EyeOff,
  RefreshCw,
  FileText,
} from "lucide-react";

interface CredentialDialogProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  credential?: any | null;
  onSaveSuccess: (savedRecord: any) => void;
}

export function CredentialDialog({
  open,
  onClose,
  clients,
  credential = null,
  onSaveSuccess,
}: CredentialDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!credential;

  // Form Fields
  const [clientId, setClientId] = useState("");
  const [label, setLabel] = useState("");
  const [credentialType, setCredentialType] = useState<CredentialType>("other");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    const prefillData = async () => {
      if (credential && open) {
        setClientId(credential.client_id || "");
        setLabel(credential.label);
        setCredentialType(credential.credential_type);
        setUrl(credential.url || "");
        
        // Fetch decryptions from server-side decrypt API
        try {
          const [userRes, passRes, notesRes] = await Promise.all([
            fetch("/api/vault/decrypt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: credential.username_encrypted }),
            }).then((r) => r.json()),
            fetch("/api/vault/decrypt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: credential.password_encrypted }),
            }).then((r) => r.json()),
            credential.notes_encrypted
              ? fetch("/api/vault/decrypt", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: credential.notes_encrypted }),
                }).then((r) => r.json())
              : Promise.resolve({ decrypted: "" }),
          ]);

          setUsername(userRes.decrypted || "");
          setPassword(passRes.decrypted || "");
          setNotes(notesRes.decrypted || "");
        } catch (err) {
          toast.error("Failed to decrypt current credentials for editing");
        }
      } else {
        setClientId("");
        setLabel("");
        setCredentialType("other");
        setUrl("");
        setUsername("");
        setPassword("");
        setNotes("");
      }
    };
    prefillData();
  }, [credential, open]);

  // Premium password generator helper
  const handleGeneratePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    const len = 16;
    let pass = "";
    for (let i = 0; i < len; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    setShowPassword(true);
    toast.success("Generated strong password");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error("Please select a client");
      return;
    }
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }

    startTransition(async () => {
      try {
        // 1. Perform server-side encryption calls to encrypt values using GCM
        const [userEnc, passEnc, notesEnc] = await Promise.all([
          fetch("/api/vault/encrypt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: username.trim() }),
          }).then((r) => r.json()),
          fetch("/api/vault/encrypt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: password.trim() }),
          }).then((r) => r.json()),
          notes.trim()
            ? fetch("/api/vault/encrypt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: notes.trim() }),
              }).then((r) => r.json())
            : Promise.resolve({ encrypted: null }),
        ]);

        if (userEnc.error || passEnc.error || notesEnc.error) {
          toast.error(userEnc.error || passEnc.error || notesEnc.error || "Encryption failed");
          return;
        }

        const payload = {
          client_id: clientId,
          label: label.trim(),
          credential_type: credentialType,
          url: url.trim() || null,
          username_encrypted: userEnc.encrypted,
          password_encrypted: passEnc.encrypted,
          notes_encrypted: notesEnc.encrypted,
        };

        if (isEditing && credential) {
          const result = await updateVaultCredential(credential.id, payload);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Credential updated successfully");
            onSaveSuccess({
              ...credential,
              ...payload,
              client: clients.find((c) => c.id === clientId),
            });
            onClose();
          }
        } else {
          const result = await createVaultCredential(payload);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Credential stored securely");
            onSaveSuccess({
              ...result.data,
              client: clients.find((c) => c.id === clientId),
            });
            onClose();
          }
        }
      } catch (err: any) {
        toast.error(`Unexpected saving error: ${err.message || err}`);
      }
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isPending && onClose()} />

      <form
        onSubmit={handleSave}
        className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-burgundy" />
            <span>{isEditing ? "Edit Vault Credential" : "Store Secure Credential"}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Client select & Credential type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Associated Client
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={isPending}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Access Type
              </label>
              <select
                value={credentialType}
                onChange={(e) => setCredentialType(e.target.value as any)}
                disabled={isPending}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              >
                {CREDENTIAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Label & URL */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Label / Name
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="WordPress Admin, cPanel Main"
                disabled={isPending}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-muted-foreground/80" />
                URL Address
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/login"
                disabled={isPending}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>
          </div>

          {/* Username & Password */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-muted-foreground/80" />
                Username / Login
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@example.com"
                disabled={isPending}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[10px] text-burgundy hover:underline flex items-center gap-0.5 leading-none font-bold"
                  title="Generate a secure strong password"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Generate</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  disabled={isPending}
                  className="w-full h-10 pl-3 pr-10 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-muted-foreground/80" />
              Notes (Encrypted)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="DB names, port numbers, recovery email settings..."
              rows={3}
              disabled={isPending}
              className="w-full p-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
            />
          </div>

          <div className="bg-burgundy/5 border border-burgundy/20 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-muted-foreground leading-normal">
            <ShieldAlert className="w-4 h-4 text-burgundy shrink-0 mt-0.5" />
            <span>
              All credential values (username, password, and notes) are securely encrypted on the server before they are stored in the database.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !clientId || !label.trim() || !username.trim() || !password.trim()}
            className="h-10 px-5 rounded-xl gradient-burgundy text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Encrypting...</span>
              </>
            ) : (
              <span>{isEditing ? "Save Changes" : "Secure Store"}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
