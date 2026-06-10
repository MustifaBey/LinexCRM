import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { PortalCredentials } from "@/components/portal/portal-credentials";
import {
  Folder,
  CheckCircle2,
  XCircle,
  ImagePlus,
  Calendar,
  Globe,
  Lock,
  ExternalLink,
  Shield,
  Eye
} from "lucide-react";
import { updateMediaStatus } from "@/actions/media";
import { revalidatePath } from "next/cache";
import { cn } from "@/lib/utils";
import { decrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

// Server action to handle inline approval/rejection of media files
async function handleMediaAction(formData: FormData) {
  "use server";
  const fileId = formData.get("fileId") as string;
  const action = formData.get("action") as "approved" | "rejected";

  if (!fileId || !action) return;

  await updateMediaStatus(fileId, action);
  revalidatePath("/portal");
}

function safeDecrypt(val: string | null): string {
  if (!val) return "";
  try {
    return decrypt(val);
  } catch (e) {
    return val;
  }
}

const SERVICE_TYPE_MAP = {
  domain: { label: "Alan Adı", color: "bg-blue-950/40 text-blue-400 border-blue-800/40" },
  hosting: { label: "Hosting", color: "bg-purple-950/40 text-purple-400 border-purple-800/40" },
  ssl: { label: "SSL Sertifikası", color: "bg-emerald-950/40 text-emerald-400 border-emerald-800/40" },
  email: { label: "Kurumsal E-posta", color: "bg-amber-950/40 text-amber-400 border-amber-800/40" },
};

const CREDENTIAL_TYPE_MAP = {
  cpanel: "cPanel Kontrol Paneli",
  wordpress: "WordPress Yönetim",
  ftp: "FTP Sunucu Bağlantısı",
  vercel: "Vercel Panel",
  hosting: "Hosting Provider",
  domain_registrar: "Alan Adı Kayıt Firması",
  email: "E-posta Giriş Bilgileri",
  social_media: "Sosyal Medya Hesabı",
  other: "Diğer Erişim Bilgisi",
};

const POST_STATUS_MAP = {
  draft: { label: "Taslak", bg: "bg-zinc-850/80 text-zinc-300 border-zinc-700/60" },
  pending: { label: "Ajans Onayında", bg: "bg-amber-950/40 text-amber-400 border-amber-800/50" },
  published: { label: "Yayınlandı", bg: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50" },
};

function Progress({ value }: { value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-semibold text-muted-foreground">
        <span>Proje İlerlemesi</span>
        <span className="text-foreground font-semibold">{value}%</span>
      </div>
      <div className="w-full bg-input rounded-full h-2 overflow-hidden border border-border/40">
        <div
          className="bg-burgundy h-full transition-all duration-500 rounded-full"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default async function PortalDashboardPage() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get current user's profile to check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  const isClient = profile?.role === "client";

  // 1. Fetch Client profiles mapped to this user
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("portal_user_id", user.id) as any;

  // 2. Fetch Projects (filtered if client, fetched ALL if admin/staff)
  // We fetch projects first so we can extract client IDs from them!
  let projects: any[] = [];
  if (isClient) {
    // Collect client IDs from client profile
    const baseClientIds: string[] = [];
    if (clients) {
      clients.forEach((c: any) => baseClientIds.push(c.id));
    }
    baseClientIds.push(user.id);

    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .in("client_id", baseClientIds)
      .order("created_at", { ascending: false }) as any;
    projects = projectsData || [];
  } else {
    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false }) as any;
    projects = projectsData || [];
  }

  // Merge client IDs from profiles and projects for thorough filtering
  const clientIds: string[] = [];
  if (clients) {
    clients.forEach((c: any) => clientIds.push(c.id));
  }
  projects.forEach((p: any) => {
    if (p.client_id) clientIds.push(p.client_id);
  });
  clientIds.push(user.id);
  const uniqueClientIds = Array.from(new Set(clientIds));

  // If no client profile is linked AND no projects match the user ID directly, show the error (Clients only)
  if (isClient && (!clients || clients.length === 0) && projects.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4 select-none">
        <div className="w-16 h-16 rounded-2xl bg-burgundy/10 border border-burgundy/20 flex items-center justify-center mx-auto text-burgundy">
          <Folder className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">İlişkili Müşteri Hesabı Bulunamadı</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Kullanıcı hesabınıza atanmış herhangi bir müşteri kaydı veya proje bulunmuyor. Lütfen ajans yöneticiniz ile iletişime geçin.
        </p>
      </div>
    );
  }

  const clientProjectIds = projects.map((p: any) => p.id);

  // 3. Fetch Media, Domains, Vault Credentials, and Content Calendar Posts in parallel
  const [clientMediaFiles, contentPosts, domains, credentials] = await Promise.all([
    // Media files
    !isClient
      ? supabase
          .from("media_files")
          .select("*, project:projects(name)")
          .order("created_at", { ascending: false })
          .then(res => (res.data || []).filter((f: any) => f.status !== "parent")) as Promise<any[]>
      : clientProjectIds.length > 0
      ? supabase
          .from("media_files")
          .select("*, project:projects(name)")
          .in("project_id", clientProjectIds)
          .order("created_at", { ascending: false })
          .then(res => (res.data || []).filter((f: any) => f.status !== "parent")) as Promise<any[]>
      : Promise.resolve([]),
    // Calendar posts
    !isClient
      ? supabase
          .from("content_posts")
          .select("*, project:projects(name)")
          .order("publish_date", { ascending: true })
          .then(res => res.data || []) as Promise<any[]>
      : clientProjectIds.length > 0
      ? supabase
          .from("content_posts")
          .select("*, project:projects(name)")
          .in("project_id", clientProjectIds)
          .order("publish_date", {ascending: true })
          .then(res => res.data || []) as Promise<any[]>
      : Promise.resolve([]),
    // Domain & Hosting records (Query using supabaseAdmin to bypass select RLS checks)
    !isClient
      ? supabaseAdmin
          .from("domain_records")
          .select("*")
          .order("expiration_date", { ascending: true })
          .then(res => res.data || []) as Promise<any[]>
      : supabaseAdmin
          .from("domain_records")
          .select("*")
          .in("client_id", uniqueClientIds)
          .order("expiration_date", { ascending: true })
          .then(res => res.data || []) as Promise<any[]>,
    // Vault credentials (Query using supabaseAdmin to bypass select RLS checks)
    !isClient
      ? supabaseAdmin
          .from("vault_credentials")
          .select("*")
          .order("label", { ascending: true })
          .then(res => res.data || []) as Promise<any[]>
      : supabaseAdmin
          .from("vault_credentials")
          .select("*")
          .in("client_id", uniqueClientIds)
          .order("label", { ascending: true })
          .then(res => res.data || []) as Promise<any[]>,
  ]);

  return (
    <div className="p-6 md:p-8 space-y-12 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      {/* Welcome Header banner */}
      <div className="relative rounded-3xl bg-card border border-border/70 p-6 md:p-8 overflow-hidden shadow-xl select-none">
        <div className="absolute inset-0 gradient-burgundy opacity-5" />
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-black text-foreground">Hoş Geldiniz, {clients?.[0]?.name || "Değerli Müşterimiz"}</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Ajansımız ile yürüttüğünüz projelerin durumunu inceleyin, içerik planlarını kontrol edin ve tasarım dosyalarınızı onaylayın.
            </p>
          </div>
          <Link
            href="/portal/tickets"
            className="px-5 py-3 rounded-2xl bg-burgundy hover:bg-burgundy-light text-white font-bold text-sm transition-all shadow-lg shadow-burgundy/20 shrink-0"
          >
            Destek Talebi Oluştur
          </Link>
        </div>
      </div>

      {/* SECTION 1: Projects */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Folder className="w-5 h-5 text-burgundy" />
          <h2 className="text-lg font-extrabold text-foreground">Projelerim</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-2 text-center p-12 border border-dashed border-border/80 rounded-2xl text-muted-foreground text-sm">
              Atanmış projeniz bulunmamaktadır.
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="bg-card border border-border/80 rounded-2xl p-6 shadow-lg space-y-4 hover:border-border transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-base text-foreground truncate">{project.name}</h3>
                  <span className="text-[10px] bg-burgundy/15 text-burgundy border border-burgundy/30 px-2.5 py-0.5 rounded-lg font-bold uppercase tracking-wider">
                    {project.status === "active" ? "Aktif" : "Planlama"}
                  </span>
                </div>
                {project.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {project.description}
                  </p>
                )}
                {project.start_date && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date(project.start_date).toLocaleDateString("tr-TR")}
                      {project.end_date && ` - ${new Date(project.end_date).toLocaleDateString("tr-TR")}`}
                    </span>
                  </div>
                )}
                <Progress value={project.progress || 0} />
              </div>
            ))
          )}
        </div>
      </section>

      {/* SECTION 2: Media Files */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <ImagePlus className="w-5 h-5 text-burgundy" />
          <h2 className="text-lg font-extrabold text-foreground">Dosyalarım</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientMediaFiles.length === 0 ? (
            <div className="col-span-3 text-center p-12 border border-dashed border-border/80 rounded-2xl text-muted-foreground text-sm">
              Paylaşılan dosya bulunmamaktadır.
            </div>
          ) : (
            clientMediaFiles.map((file) => {
              const isApproved = file.status === "approved";
              const isRejected = file.status === "rejected";
              const isPendingReview = file.status === "in_review" || file.status === "uploaded";

              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
              const fileUrl = `${supabaseUrl}/storage/v1/object/public/media/${file.file_path}`;

              return (
                <div
                  key={file.id}
                  className="bg-card border border-border/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between min-h-[320px] hover:border-border transition-all"
                >
                  <Link
                    href={`/portal/media/${file.id}`}
                    className="relative aspect-video rounded-xl bg-muted overflow-hidden flex items-center justify-center border border-border/40 select-none cursor-pointer hover:opacity-95 transition-opacity block"
                  >
                    {file.file_type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl} alt={file.file_name} className="object-cover w-full h-full" />
                    ) : (
                      <div className="text-center p-4">
                        <ImagePlus className="w-10 h-10 text-muted-foreground/80 mx-auto mb-2" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          {file.file_type.split("/")[1] || "Dosya"}
                        </span>
                      </div>
                    )}

                    <div className="absolute top-2.5 right-2.5">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border backdrop-blur-md shadow-sm",
                          isApproved && "bg-emerald-950/60 border-emerald-800/60 text-emerald-400",
                          isRejected && "bg-red-950/60 border-red-800/60 text-red-400",
                          isPendingReview && "bg-zinc-850/70 border-zinc-700/60 text-zinc-300"
                        )}
                      >
                        {isApproved && "Onaylandı"}
                        {isRejected && "Reddedildi"}
                        {isPendingReview && "Onay Bekliyor"}
                      </span>
                    </div>
                  </Link>

                  <div className="space-y-1 mt-4">
                    <h3 className="font-bold text-sm text-foreground truncate" title={file.file_name}>
                      {file.file_name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">Proje: {file.project?.name}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/40 flex gap-2 w-full select-none">
                    {isPendingReview ? (
                      <>
                        <form action={handleMediaAction} className="flex-1">
                          <input type="hidden" name="fileId" value={file.id} />
                          <input type="hidden" name="action" value="approved" />
                          <button
                            type="submit"
                            className="w-full h-9 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-800/40 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Onayla</span>
                          </button>
                        </form>

                        <form action={handleMediaAction} className="flex-1">
                          <input type="hidden" name="fileId" value={file.id} />
                          <input type="hidden" name="action" value="rejected" />
                          <button
                            type="submit"
                            className="w-full h-9 rounded-xl bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 text-red-400 hover:text-red-300 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reddet</span>
                          </button>
                        </form>
                      </>
                    ) : (
                      <div className="w-full text-center py-2 text-[11px] text-muted-foreground bg-muted/20 border border-border/30 rounded-xl">
                        {isApproved && "Bu tasarım dosyası onaylanmıştır."}
                        {isRejected && "Bu tasarım dosyası reddedilmiştir."}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* SECTION 3: Content Calendar Posts */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Calendar className="w-5 h-5 text-burgundy" />
          <h2 className="text-lg font-extrabold text-foreground">İçerik Planı (Sosyal Medya & Yayınlar)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contentPosts.length === 0 ? (
            <div className="col-span-3 text-center p-12 border border-dashed border-border/80 rounded-2xl text-muted-foreground text-sm">
              Yaklaşan içerik planı bulunmamaktadır.
            </div>
          ) : (
            contentPosts.map((post) => {
              const statusInfo = POST_STATUS_MAP[post.status as keyof typeof POST_STATUS_MAP] || { label: "Taslak", bg: "bg-zinc-800 text-zinc-300 border-zinc-700" };
              return (
                <div
                  key={post.id}
                  className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-border transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="text-[10px] font-bold text-burgundy bg-burgundy/5 px-2.5 py-0.5 rounded border border-burgundy/20">
                        {post.project?.name}
                      </span>
                      <span className={cn("px-2 py-0.5 rounded border text-[9px] font-bold uppercase", statusInfo.bg)}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <p className="text-xs text-foreground font-medium leading-relaxed whitespace-pre-wrap line-clamp-4">
                      {post.content}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/30 flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Yayın: {new Date(post.publish_date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* SECTION 4: Domain Records */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Globe className="w-5 h-5 text-burgundy" />
          <h2 className="text-lg font-extrabold text-foreground">Hizmetlerim & Alan Adlarım</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {domains.length === 0 ? (
            <div className="col-span-3 text-center p-12 border border-dashed border-border/80 rounded-2xl text-muted-foreground text-sm">
              Takip edilen alan adı veya hosting kaydınız bulunmamaktadır.
            </div>
          ) : (
            domains.map((dom) => {
              const serviceInfo = SERVICE_TYPE_MAP[dom.service_type as keyof typeof SERVICE_TYPE_MAP] || { label: "Hizmet", color: "bg-zinc-800 text-zinc-300 border-zinc-700" };
              const daysLeft = Math.ceil((new Date(dom.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const isExpiringSoon = daysLeft <= 30;

              return (
                <div
                  key={dom.id}
                  className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-border transition-all"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className={cn("px-2.5 py-0.5 rounded border text-[9px] font-bold uppercase", serviceInfo.color)}>
                        {serviceInfo.label}
                      </span>
                      {dom.auto_renew && (
                        <span className="text-[9px] bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 px-2 py-0.5 rounded font-bold">
                          Otomatik Yenileme
                        </span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-sm text-foreground truncate select-all">{dom.domain_name}</h3>

                    {dom.provider && (
                      <p className="text-xs text-muted-foreground">Sağlayıcı: <span className="text-foreground/85 font-medium">{dom.provider}</span></p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/30 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Son Gün:</span>
                    <span className={cn(
                      "text-xs font-bold font-mono",
                      isExpiringSoon ? "text-amber-400" : "text-foreground"
                    )}>
                      {new Date(dom.expiration_date).toLocaleDateString("tr-TR")}
                      {isExpiringSoon && ` (${daysLeft} gün kaldı!)`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* SECTION 5: Vault Credentials */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Lock className="w-5 h-5 text-burgundy" />
          <h2 className="text-lg font-extrabold text-foreground">Kasa (Erişim & Giriş Bilgileri)</h2>
        </div>

        {(() => {
          const credentialsData = credentials.map((cred) => ({
            id: cred.id,
            label: cred.label,
            typeLabel: CREDENTIAL_TYPE_MAP[cred.credential_type as keyof typeof CREDENTIAL_TYPE_MAP] || "Giriş Bilgisi",
            decryptedUser: safeDecrypt(cred.username_encrypted),
            decryptedPass: safeDecrypt(cred.password_encrypted),
            decryptedNotes: safeDecrypt(cred.notes_encrypted),
            url: cred.url,
          }));

          return <PortalCredentials credentials={credentialsData} />;
        })()}
      </section>

    </div>
  );
}
