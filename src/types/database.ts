/**
 * LinexCRM — Database Type Definitions
 * These types mirror the Supabase schema for type safety.
 */

export type UserRole = "owner" | "admin" | "member" | "client";
export type ProjectStatus = "planning" | "active" | "paused" | "completed" | "archived";
export type PipelineStatus = "lead" | "contacted" | "proposal" | "won" | "lost";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type MediaStatus = "uploaded" | "in_review" | "approved" | "rejected";
export type ServiceType = "domain" | "hosting" | "ssl" | "email";
export type CredentialType =
  | "cpanel"
  | "wordpress"
  | "ftp"
  | "vercel"
  | "hosting"
  | "domain_registrar"
  | "email"
  | "social_media"
  | "other";
export type TransactionType = "income" | "expense";
export type TransactionCategory =
  | "project_payment"
  | "retainer"
  | "consultation"
  | "hosting"
  | "domain"
  | "software"
  | "salary"
  | "marketing"
  | "office"
  | "tax"
  | "other";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
export type NotificationType = "info" | "warning" | "error" | "success";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  sound_volume: number;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  logo_url: string | null;
  notes: string | null;
  portal_user_id: string | null;
  pipeline_status: PipelineStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  instagram_url: string | null;
  maps_url: string | null;
  website_url: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  progress: number;
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
  members?: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: "lead" | "member" | "viewer";
  created_at: string;
  // Joined fields
  profile?: Profile;
}

export interface KanbanColumn {
  id: string;
  project_id: string;
  title: string;
  position: number;
  color: string;
  created_at: string;
  // Joined fields
  tasks?: Task[];
}

export interface Task {
  id: string;
  project_id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  position: number;
  assigned_to: string | null;
  due_date: string | null;
  start_date: string | null;
  estimated_hours: number | null;
  labels: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  assignee?: Profile;
}

export interface MediaFile {
  id: string;
  project_id: string | null;
  client_id: string | null;
  file_name: string;
  file_path: string;
  thumbnail_path: string | null;
  file_type: string;
  file_size: number;
  version: number;
  parent_file_id: string | null;
  status: MediaStatus;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  uploader?: Profile;
  annotations?: MediaAnnotation[];
}

export interface MediaAnnotation {
  id: string;
  media_file_id: string;
  x_percent: number;
  y_percent: number;
  comment: string;
  is_resolved: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: Profile;
}

export interface DomainRecord {
  id: string;
  client_id: string;
  service_type: ServiceType;
  domain_name: string;
  provider: string | null;
  registration_date: string | null;
  expiration_date: string;
  auto_renew: boolean;
  annual_cost: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
}

export interface VaultCredential {
  id: string;
  client_id: string;
  label: string;
  credential_type: CredentialType;
  url: string | null;
  username_encrypted: string;
  password_encrypted: string;
  notes_encrypted: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: string;
  description: string | null;
  client_id: string | null;
  project_id: string | null;
  transaction_date: string;
  is_recurring: boolean;
  recurring_interval: "monthly" | "quarterly" | "yearly" | null;
  invoice_number: string | null;
  receipt_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
  project?: Project;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  project_id: string | null;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  due_date: string;
  paid_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
  project?: Project;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined fields
  user?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface MediaShare {
  id: string;
  file_id: string;
  token: string;
  expires_at: string;
  password_hash: string | null;
  created_at: string;
  // Joined fields
  file?: MediaFile;
}

export interface ContentPost {
  id: string;
  project_id: string | null;
  publish_date: string;
  content: string;
  status: "draft" | "pending" | "published";
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: Project;
}

export interface Ticket {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: Project;
  user?: Profile;
}

/**
 * Supabase Database type for typed client
 * Simplified version — in production, generate this with `supabase gen types`
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Client, "id" | "created_at">>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at" | "updated_at" | "client" | "members">;
        Update: Partial<Omit<Project, "id" | "created_at" | "client" | "members">>;
      };
      project_members: {
        Row: ProjectMember;
        Insert: Omit<ProjectMember, "id" | "created_at" | "profile">;
        Update: Partial<Omit<ProjectMember, "id" | "created_at" | "profile">>;
      };
      kanban_columns: {
        Row: KanbanColumn;
        Insert: Omit<KanbanColumn, "id" | "created_at" | "tasks">;
        Update: Partial<Omit<KanbanColumn, "id" | "created_at" | "tasks">>;
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at" | "updated_at" | "assignee">;
        Update: Partial<Omit<Task, "id" | "created_at" | "assignee">>;
      };
      media_files: {
        Row: MediaFile;
        Insert: Omit<MediaFile, "id" | "created_at" | "updated_at" | "uploader" | "annotations">;
        Update: Partial<Omit<MediaFile, "id" | "created_at" | "uploader" | "annotations">>;
      };
      media_annotations: {
        Row: MediaAnnotation;
        Insert: Omit<MediaAnnotation, "id" | "created_at" | "updated_at" | "author">;
        Update: Partial<Omit<MediaAnnotation, "id" | "created_at" | "author">>;
      };
      domain_records: {
        Row: DomainRecord;
        Insert: Omit<DomainRecord, "id" | "created_at" | "updated_at" | "client">;
        Update: Partial<Omit<DomainRecord, "id" | "created_at" | "client">>;
      };
      vault_credentials: {
        Row: VaultCredential;
        Insert: Omit<VaultCredential, "id" | "created_at" | "updated_at" | "client">;
        Update: Partial<Omit<VaultCredential, "id" | "created_at" | "client">>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at" | "updated_at" | "client" | "project">;
        Update: Partial<Omit<Transaction, "id" | "created_at" | "client" | "project">>;
      };
      invoices: {
        Row: Invoice;
        Insert: Omit<Invoice, "id" | "created_at" | "updated_at" | "client" | "project">;
        Update: Partial<Omit<Invoice, "id" | "created_at" | "client" | "project">>;
      };
      activity_log: {
        Row: ActivityLog;
        Insert: Omit<ActivityLog, "id" | "created_at" | "user">;
        Update: never;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at">;
        Update: Partial<Pick<Notification, "is_read">>;
      };
      media_shares: {
        Row: MediaShare;
        Insert: Omit<MediaShare, "id" | "created_at" | "file">;
        Update: Partial<Omit<MediaShare, "id" | "created_at" | "file">>;
      };
      content_posts: {
        Row: ContentPost;
        Insert: Omit<ContentPost, "id" | "created_at" | "updated_at" | "project">;
        Update: Partial<Omit<ContentPost, "id" | "created_at" | "project">>;
      };
      tickets: {
        Row: Ticket;
        Insert: Omit<Ticket, "id" | "created_at" | "updated_at" | "project" | "user">;
        Update: Partial<Omit<Ticket, "id" | "created_at" | "project" | "user">>;
      };
    };
  };
}
