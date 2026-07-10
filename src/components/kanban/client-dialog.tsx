"use client";

import { useState, useEffect } from "react";
import { createClientAction, updateClientAction } from "@/actions/clients";
import { uploadFileToServer } from "@/actions/storage";
import { toast } from "sonner";
import { X, Building, Loader2 } from "lucide-react";

interface ClientDialogProps {
  open: boolean;
  onClose: () => void;
  onSaveSuccess: (savedRecord: any) => void;
  editingClient?: any;
}

export function ClientDialog({
  open,
  onClose,
  onSaveSuccess,
  editingClient,
}: ClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setNotes("");
    setLogoUrl("");
  };

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name || "");
      setCompany(editingClient.company || "");
      setEmail(editingClient.contact_email || "");
      setPhone(editingClient.contact_phone || "");
      setNotes(editingClient.notes || "");
      setLogoUrl(editingClient.logo_url || "");
    } else {
      resetForm();
    }
  }, [editingClient, open]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen sadece görsel dosyaları yükleyin.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo resmi boyutu en fazla 2MB olabilir.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `client-logos/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "media");
      formData.append("path", filePath);

      const response = await uploadFileToServer(formData);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.publicUrl) {
        setLogoUrl(response.publicUrl);
        toast.success("Logo başarıyla yüklendi.");
      } else {
        throw new Error("Görsel bağlantısı alınamadı.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Logo yüklenirken hata oluştu.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Müşteri adı gereklidir");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        company: company.trim(),
        contact_email: email.trim(),
        contact_phone: phone.trim(),
        logo_url: logoUrl,
        notes: notes.trim(),
      };

      let result;
      if (editingClient) {
        result = await updateClientAction(editingClient.id, payload);
      } else {
        result = await createClientAction(payload);
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(editingClient ? "Müşteri başarıyla güncellendi" : "Müşteri başarıyla oluşturuldu");
        onSaveSuccess(result.data);
        resetForm();
        onClose();
      }
    } catch (err: any) {
      toast.error(`Beklenmeyen kayıt hatası: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isSubmitting && onClose()} />

      <form
        onSubmit={handleSave}
        className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building className="w-5 h-5 text-burgundy" />
            <span>{editingClient ? "Müşteriyi Düzenle" : "Yeni Müşteri Oluştur"}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Client Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Müşteri Adı / Unvanı
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp, Ahmet Yılmaz"
              disabled={isSubmitting}
              className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Firma Adı (İsteğe Bağlı)
            </label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Linex Medya"
              disabled={isSubmitting}
              className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>



          {/* Logo Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Logo (Opsiyonel)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border border-border flex items-center justify-center bg-muted/40 overflow-hidden shrink-0 relative group">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Logo önizleme"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building className="w-6 h-6 text-muted-foreground/60" />
                )}
                
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <input
                  type="file"
                  id="logo-upload-input"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploading || isSubmitting}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("logo-upload-input")?.click()}
                  disabled={isUploading || isSubmitting}
                  className="h-9 px-4 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground/80 hover:text-foreground transition-all flex items-center gap-1.5"
                >
                  {isUploading ? "Yükleniyor..." : "Logo Yükle"}
                </button>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  PNG, JPG veya SVG. En fazla 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@domain.com"
                disabled={isSubmitting}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Telefon
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0555 555 5555"
                disabled={isSubmitting}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Notlar
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Müşteri hakkında özel detaylar veya fatura bilgileri..."
              rows={3}
              disabled={isSubmitting}
              className="w-full p-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="h-10 px-5 rounded-xl gradient-burgundy text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{editingClient ? "Güncelleniyor..." : "Oluşturuluyor..."}</span>
              </>
            ) : (
              <span>{editingClient ? "Kaydet" : "Oluştur"}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
