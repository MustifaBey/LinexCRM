"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Transaction } from "@/types/database";
import { logActivity } from "./activity";

/**
 * Helper function to enforce owner/admin role verification for mutations.
 */
async function verifyAdminAccess() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    throw new Error("Access denied. Admin role required.");
  }

  return user.id;
}

/**
 * Helper function to enforce staff (owner, admin, member) role verification for reads.
 */
async function verifyStaffAccess() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  if (!profile || !["owner", "admin", "member"].includes(profile.role)) {
    throw new Error("Access denied. Staff role required.");
  }

  return user.id;
}

/**
 * Retrieve all transactions, joining client and project data.
 */
export async function getTransactions() {
  try {
    await verifyStaffAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("transactions")
      .select("*, client:clients(id, name, company), project:projects(id, name)")
      .order("transaction_date", { ascending: false }) as any;

    if (error) {
      return { error: error.message, data: null };
    }

    return { data: data as any[], error: null };
  } catch (err: any) {
    return { error: err.message || "Failed to retrieve transactions", data: null };
  }
}

/**
 * Create a new financial transaction.
 */
export async function createTransaction(data: {
  type: "income" | "expense";
  category: string;
  amount: number;
  currency: string;
  description?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  transaction_date: string;
  is_recurring: boolean;
  recurring_interval?: "monthly" | "quarterly" | "yearly" | null;
  invoice_number?: string | null;
  receipt_url?: string | null;
}) {
  try {
    const userId = await verifyAdminAccess();
    const supabase = await createClient();

    // Enforce constraints on recurring interval
    const recurringInterval = data.is_recurring ? (data.recurring_interval || "monthly") : null;

    const { data: newRecord, error } = await supabase
      .from("transactions")
      .insert({
        type: data.type,
        category: data.category,
        amount: data.amount,
        currency: data.currency || "TRY",
        description: data.description?.trim() || null,
        client_id: data.client_id || null,
        project_id: data.project_id || null,
        transaction_date: data.transaction_date,
        is_recurring: data.is_recurring,
        recurring_interval: recurringInterval,
        invoice_number: data.invoice_number?.trim() || null,
        receipt_url: data.receipt_url || null,
        created_by: userId,
      } as any)
      .select()
      .single() as any;

    if (error) {
      return { error: error.message };
    }

    // Log activity
    try {
      await logActivity(
        `yeni bir finansal işlem kaydetti: ${data.type === 'income' ? 'Gelir' : 'Gider'} - ${data.amount} TRY (${data.category})`,
        "finance",
        newRecord.id,
        { projectName: "Finans Defteri" }
      );
    } catch (err) {
      console.error(err);
    }

    revalidatePath("/finance");
    return { data: newRecord, error: null };
  } catch (err: any) {
    return { error: err.message || "Failed to create transaction" };
  }
}

/**
 * Update an existing transaction.
 */
export async function updateTransaction(
  id: string,
  updates: Partial<{
    type: "income" | "expense";
    category: string;
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
  }>
) {
  try {
    await verifyAdminAccess();
    const supabase = await createClient();

    // If changing recurring status, ensure interval is adjusted accordingly
    const patchedUpdates: any = { ...updates };
    if (updates.is_recurring === false) {
      patchedUpdates.recurring_interval = null;
    } else if (updates.is_recurring === true && !updates.recurring_interval) {
      patchedUpdates.recurring_interval = "monthly";
    }

    const { error } = await (supabase
      .from("transactions") as any)
      .update({
        ...patchedUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/finance");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update transaction" };
  }
}

/**
 * Delete a transaction.
 */
export async function deleteTransaction(id: string) {
  try {
    await verifyAdminAccess();
    const supabase = await createClient();

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/finance");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete transaction" };
  }
}

/**
 * Calculate totals (Income, Expense, Net Profit, and MRR).
 */
export async function getNetProfit() {
  try {
    await verifyStaffAccess();
    const supabase = await createClient();

    const { data: txs, error } = await supabase
      .from("transactions")
      .select("type, amount, is_recurring, recurring_interval") as any;

    if (error) {
      throw new Error(error.message);
    }

    let totalIncome = 0;
    let totalExpense = 0;
    let mrr = 0;

    txs.forEach((tx: any) => {
      const amount = Number(tx.amount) || 0;

      if (tx.type === "income") {
        totalIncome += amount;

        // Calculate Monthly Recurring Revenue component
        if (tx.is_recurring) {
          if (tx.recurring_interval === "monthly") {
            mrr += amount;
          } else if (tx.recurring_interval === "quarterly") {
            mrr += amount / 3;
          } else if (tx.recurring_interval === "yearly") {
            mrr += amount / 12;
          }
        }
      } else {
        totalExpense += amount;
      }
    });

    const netProfit = totalIncome - totalExpense;

    return {
      data: {
        totalIncome,
        totalExpense,
        netProfit,
        mrr,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: { totalIncome: 0, totalExpense: 0, netProfit: 0, mrr: 0 },
      error: err.message || "Failed to calculate financial metrics",
    };
  }
}

/**
 * Retrieve monthly breakdown for charts.
 * Processes the past 6 months of records dynamically.
 */
export async function getMonthlyReport() {
  try {
    await verifyStaffAccess();
    const supabase = await createClient();

    const { data: txs, error } = await supabase
      .from("transactions")
      .select("type, amount, transaction_date") as any;

    if (error) {
      throw new Error(error.message);
    }

    // Prepare container for the last 6 months
    const reportData: Record<string, { income: number; expense: number; label: string; yearMonth: string }> = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      reportData[key] = {
        income: 0,
        expense: 0,
        label: `${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`,
        yearMonth: key
      };
    }

    txs.forEach((tx: any) => {
      if (!tx.transaction_date) return;
      const dateParts = tx.transaction_date.split("-");
      if (dateParts.length < 2) return;
      const key = `${dateParts[0]}-${dateParts[1]}`;

      if (reportData[key]) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === "income") {
          reportData[key].income += amt;
        } else {
          reportData[key].expense += amt;
        }
      }
    });

    const list = Object.values(reportData).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

    return {
      data: list.map((item) => ({
        month: item.label,
        income: item.income,
        expense: item.expense,
        profit: item.income - item.expense,
      })),
      error: null,
    };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to build monthly report" };
  }
}

/**
 * Auto-generate an invoice from a ledger transaction.
 */
export async function createInvoiceFromTransaction(transactionId: string) {
  try {
    const userId = await verifyAdminAccess();
    const supabase = await createClient();

    // Fetch transaction
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single() as any;

    if (txError || !tx) {
      return { error: "İşlem bulunamadı." };
    }

    if (!tx.client_id) {
      return { error: "Fatura oluşturmak için işlemin bir müşteriye atanmış olması gerekir." };
    }

    // Generate unique invoice number if not present
    let invoiceNumber = tx.invoice_number || `FAT-${Math.floor(100000 + Math.random() * 900000)}`;

    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("invoice_number", invoiceNumber)
      .maybeSingle() as any;

    if (existingInvoice) {
      return { error: `Bu işlem için zaten bir fatura oluşturulmuş (${invoiceNumber}).` };
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 14 days payment term

    const status = tx.type === "income" ? "paid" : "draft";
    const paidDate = status === "paid" ? tx.transaction_date : null;

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        client_id: tx.client_id,
        project_id: tx.project_id || null,
        amount: tx.amount,
        currency: tx.currency || "TRY",
        status,
        due_date: dueDate.toISOString().split("T")[0],
        paid_date: paidDate,
        notes: tx.description || "İşlem kaydından otomatik oluşturuldu.",
        created_by: userId,
      } as any)
      .select()
      .single() as any;

    if (invError) {
      return { error: invError.message };
    }

    // Link transaction to generated invoice_number if not linked
    if (!tx.invoice_number) {
      await (supabase
        .from("transactions") as any)
        .update({ invoice_number: invoiceNumber })
        .eq("id", transactionId);
    }

    revalidatePath("/finance");
    return { data: invoice, error: null };
  } catch (err: any) {
    return { error: err.message || "Fatura oluşturulamadı." };
  }
}

/**
 * Retrieve a single invoice with client and project details.
 */
export async function getInvoice(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Kimlik doğrulaması gerekiyor.", data: null };

    // Fetch the profile role to check authorization
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as any;

    const isStaff = profile && ["owner", "admin", "member"].includes(profile.role);

    // Build query
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        *,
        client:clients(*),
        project:projects(id, name)
      `)
      .eq("id", id)
      .single() as any;

    if (error || !invoice) {
      return { error: "Fatura bulunamadı.", data: null };
    }

    // Check permissions if user is a client
    if (!isStaff) {
      if (invoice.client?.portal_user_id !== user.id) {
        return { error: "Bu faturayı görüntüleme yetkiniz yok.", data: null };
      }
    }

    return { data: invoice, error: null };
  } catch (err: any) {
    return { error: err.message || "Fatura yüklenemedi.", data: null };
  }
}
