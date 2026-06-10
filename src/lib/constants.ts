/**
 * LinexCRM — Application Constants
 */

export const APP_NAME = "LinexCRM";
export const APP_DESCRIPTION = "Linex Medya Premium CRM & Ajans Yönetim Sistemi";
export const AGENCY_NAME = "Linex Medya";

/** Navigation items for the dashboard sidebar */
export const NAV_ITEMS = [
  {
    title: "Panel",
    href: "/",
    icon: "LayoutDashboard" as const,
    description: "Genel bakış & analizler",
    adminOnly: false,
    clientOnly: false,
  },
  {
    title: "Projeler",
    href: "/projects",
    icon: "Kanban" as const,
    description: "Kanban panoları & zaman çizelgeleri",
    adminOnly: false,
    clientOnly: false,
  },
  {
    title: "Müşteriler",
    href: "/clients",
    icon: "Users" as const,
    description: "Müşteri listesi & iletişim",
    adminOnly: true,
    clientOnly: false,
  },
  {
    title: "Ekip",
    href: "/team",
    icon: "Users" as const,
    description: "Ekip efor & kaynak yönetimi",
    adminOnly: true,
    clientOnly: false,
  },
  {
    title: "Medya Kasası",
    href: "/media",
    icon: "ImagePlus" as const,
    description: "Dosyalar & onay süreci",
    adminOnly: false,
    clientOnly: false,
  },
  {
    title: "Alan Adları",
    href: "/domains",
    icon: "Globe" as const,
    description: "Alan adı & barındırma takibi",
    adminOnly: false,
    clientOnly: false,
  },
  {
    title: "Şifre Kasası",
    href: "/vault",
    icon: "Lock" as const,
    description: "Şifreli kimlik bilgileri",
    adminOnly: false,
    clientOnly: false,
  },
  {
    title: "Finans",
    href: "/finance",
    icon: "TrendingUp" as const,
    description: "Gelir, gider & MRR",
    adminOnly: true,
    clientOnly: false,
  },
  {
    title: "İçerik Takvimi",
    href: "/calendar",
    icon: "Calendar" as const,
    description: "Sosyal medya & içerik planlama",
    adminOnly: false,
    clientOnly: false,
  },
  {
    title: "Satış & Teklif",
    href: "/pipeline",
    icon: "Filter" as const,
    description: "Müşteri adayları & satış hunisi",
    adminOnly: true,
    clientOnly: false,
  },
  {
    title: "Destek Talepleri",
    href: "/tickets",
    icon: "LifeBuoy" as const,
    description: "Destek biletleri yönetimi",
    adminOnly: true,
    clientOnly: false,
  },
  {
    title: "Ekip Sohbeti",
    href: "/chat",
    icon: "MessageSquare" as const,
    description: "Ekip içi anlık sohbet",
    adminOnly: true,
    clientOnly: false,
  },
  {
    title: "Müşteri Portalı",
    href: "/portal",
    icon: "Users" as const,
    description: "Müşteri özel alanı",
    adminOnly: true,
    clientOnly: true,
  },
  {
    title: "Profil Ayarları",
    href: "/settings",
    icon: "Settings" as const,
    description: "Kullanıcı & profil",
    adminOnly: false,
    clientOnly: false,
  },
] as const;

/** Task priority options */
export const TASK_PRIORITIES = [
  { value: "low", label: "Düşük", color: "#6b7280" },
  { value: "medium", label: "Orta", color: "#3b82f6" },
  { value: "high", label: "Yüksek", color: "#f59e0b" },
  { value: "urgent", label: "Acil", color: "#ef4444" },
] as const;

/** Default kanban columns for new projects */
export const DEFAULT_KANBAN_COLUMNS = [
  { title: "Yapılacaklar", position: 0, color: "#6366f1" },
  { title: "Devam Edenler", position: 1, color: "#f59e0b" },
  { title: "İncelemede", position: 2, color: "#06b6d4" },
  { title: "Tamamlandı", position: 3, color: "#22c55e" },
] as const;

/** Credential type labels */
export const CREDENTIAL_TYPES = [
  { value: "cpanel", label: "cPanel" },
  { value: "wordpress", label: "WordPress" },
  { value: "ftp", label: "FTP" },
  { value: "vercel", label: "Vercel" },
  { value: "hosting", label: "Hosting / Sunucu" },
  { value: "domain_registrar", label: "Alan Adı Kayıt Firması" },
  { value: "email", label: "E-posta" },
  { value: "social_media", label: "Sosyal Medya" },
  { value: "other", label: "Diğer" },
] as const;

/** Transaction categories */
export const TRANSACTION_CATEGORIES = {
  income: [
    { value: "project_payment", label: "Proje Ödemesi" },
    { value: "retainer", label: "Aylık Düzenli Hizmet" },
    { value: "consultation", label: "Danışmanlık" },
    { value: "other", label: "Diğer Gelir" },
  ],
  expense: [
    { value: "hosting", label: "Sunucu / Hosting" },
    { value: "domain", label: "Alan Adı" },
    { value: "software", label: "Yazılım / Lisans" },
    { value: "salary", label: "Maaş / Ödeme" },
    { value: "marketing", label: "Reklam / Pazarlama" },
    { value: "office", label: "Ofis / Kira" },
    { value: "tax", label: "Vergi / Harç" },
    { value: "other", label: "Diğer Gider" },
  ],
} as const;

/** Project status configurations */
export const PROJECT_STATUSES = [
  { value: "planning", label: "Planlama", color: "#6366f1" },
  { value: "active", label: "Aktif", color: "#3b82f6" },
  { value: "paused", label: "Durduruldu", color: "#f59e0b" },
  { value: "completed", label: "Tamamlandı", color: "#22c55e" },
  { value: "archived", label: "Arşivlendi", color: "#6b7280" },
] as const;

/** CRM Pipeline Stage configurations */
export const PIPELINE_STATUSES = [
  { value: "lead", label: "Potansiyel Müşteri", color: "#6366f1" },
  { value: "contacted", label: "İletişime Geçildi", color: "#3b82f6" },
  { value: "proposal", label: "Teklif Sunuldu", color: "#f59e0b" },
  { value: "won", label: "Kazanıldı", color: "#22c55e" },
  { value: "lost", label: "Kaybedildi", color: "#ef4444" },
] as const;

/** Ticket status configurations */
export const TICKET_STATUSES = [
  { value: "open", label: "Açık", color: "#ef4444" },
  { value: "in_progress", label: "Devam Ediyor", color: "#3b82f6" },
  { value: "resolved", label: "Çözüldü", color: "#22c55e" },
  { value: "closed", label: "Kapatıldı", color: "#6b7280" },
] as const;

/** Ticket priority configurations */
export const TICKET_PRIORITIES = [
  { value: "low", label: "Düşük", color: "#6b7280" },
  { value: "medium", label: "Orta", color: "#3b82f6" },
  { value: "high", label: "Yüksek", color: "#f59e0b" },
  { value: "urgent", label: "Acil", color: "#ef4444" },
] as const;
