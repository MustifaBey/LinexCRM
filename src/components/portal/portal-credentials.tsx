"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Shield, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PortalCredentialsProps {
  credentials: any[];
}

export function PortalCredentials({ credentials }: PortalCredentialsProps) {
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} başarıyla kopyalandı.`, {
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    });
  };

  if (credentials.length === 0) {
    return (
      <div className="col-span-3 text-center p-12 border border-dashed border-border/80 rounded-2xl text-muted-foreground text-sm bg-card/15">
        Kayıtlı giriş bilgisi bulunmamaktadır.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {credentials.map((cred) => {
        const isRevealed = revealedIds[cred.id];
        return (
          <div
            key={cred.id}
            className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg space-y-4 hover:border-border transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2.5">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-sm text-foreground truncate max-w-[200px]" title={cred.label}>
                    {cred.label}
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-semibold">{cred.typeLabel}</p>
                </div>
                <Shield className="w-4 h-4 text-primary shrink-0" />
              </div>

              <div className="space-y-2 bg-input/20 border border-border/40 p-3 rounded-xl text-xs">
                {cred.decryptedUser && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">Kullanıcı Adı</span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-foreground font-semibold select-all truncate">
                        {cred.decryptedUser}
                      </span>
                      <button
                        onClick={() => handleCopy(cred.decryptedUser, "Kullanıcı adı")}
                        className="p-1 rounded text-muted-foreground hover:text-primary shrink-0"
                        title="Kullanıcı adını kopyala"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-0.5 pt-1.5 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Şifre</span>
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn("font-mono font-semibold truncate", isRevealed ? "text-foreground select-all" : "text-muted-foreground/60 select-none")}>
                      {isRevealed ? cred.decryptedPass : "••••••••••••"}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleReveal(cred.id)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground"
                        title={isRevealed ? "Gizle" : "Göster"}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {isRevealed && (
                        <button
                          onClick={() => handleCopy(cred.decryptedPass, "Şifre")}
                          className="p-1 rounded text-muted-foreground hover:text-primary"
                          title="Şifreyi kopyala"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {cred.decryptedNotes && (
                  <div className="flex flex-col gap-0.5 pt-1.5 border-t border-border/30">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">Notlar</span>
                    <span className="text-foreground/80 leading-relaxed truncate">{cred.decryptedNotes}</span>
                  </div>
                )}
              </div>
            </div>

            {cred.url && (
              <div className="pt-2 border-t border-border/30">
                <a
                  href={cred.url.startsWith("http") ? cred.url : `https://${cred.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 bg-primary/5 px-2.5 py-1.5 rounded-xl border border-primary/25 w-fit"
                >
                  <span>Giriş Sayfasına Git</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
