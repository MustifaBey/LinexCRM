"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Client, Project } from "@/types/database";
import { createTransaction, updateTransaction, deleteTransaction, createInvoiceFromTransaction } from "@/actions/finance";
import { uploadFileToServer, deleteFileFromServer } from "@/actions/storage";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { TRANSACTION_CATEGORIES } from "@/lib/constants";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  X,
  Loader2,
  TrendingDown,
  TrendingUp,
  FileText,
  UploadCloud,
  FileCheck,
  Calendar,
  Layers,
  Building,
  DollarSign,
  ArrowRightLeft,
  CheckCircle,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { EmptyState } from "../shared/empty-state";

interface LedgerGridProps {
  transactions: any[];
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  clients: Client[];
  projects: Project[];
  userRole: "owner" | "admin" | "member" | "client";
}

export function LedgerGrid({
  transactions: allTransactions,
  setTransactions: setAllTransactions,
  clients,
  projects,
  userRole,
}: LedgerGridProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // ─── Pagination: derive everything from the prop, no client-side Supabase ───
  // RLS on the transactions table requires auth.uid() which is unavailable in
  // Electron's createBrowserClient context. The parent (Server Component) already
  // fetches all transactions with the service-role / server auth and passes them
  // here as `allTransactions`. We simply filter + paginate in memory.

  const PAGE_SIZE = 10;

  // 1. Apply filters to the full prop list
  const filteredTransactions = useMemo(() => {
    let result = [...allTransactions];

    if (typeFilter !== "all") {
      result = result.filter((t) => t.type === typeFilter);
    }
    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.description?.toLowerCase().includes(q) ||
          t.invoice_number?.toLowerCase().includes(q) ||
          t.client?.name?.toLowerCase().includes(q) ||
          t.project?.name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allTransactions, search, typeFilter, categoryFilter]);

  // 2. Derived counts — no Supabase request needed
  const totalCount = filteredTransactions.length;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // 3. Paginated slice shown in the table
  const transactions = useMemo(() => {
    const from = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(from, from + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, categoryFilter]);

  // Mutation and Dialog States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);
  // Table loading state (disabled during mutations / async ops)
  const [isTableLoading, setIsTableLoading] = useState(false);
  // Delete confirmation modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<{ id: string; fileToClean: string | null } | null>(null);

  // Optimistic Loading feedback rows
  const [updatingRowIds, setUpdatingRowIds] = useState<Record<string, boolean>>({});

  // Form Fields
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("project_payment");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  
  // Storage attachment states
  const [selectedReceiptFile, setSelectedReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = ["owner", "admin"].includes(userRole);

  const handleOpenCreate = () => {
    if (!isAdmin) {
      toast.error("Access denied. You do not have permissions to modify finances.");
      return;
    }
    setEditingTx(null);
    setClientId("");
    setProjectId("");
    setType("income");
    setCategory("project_payment");
    setAmount("");
    setCurrency("TRY");
    setDescription("");
    setTransactionDate(new Date().toISOString().split("T")[0]);
    setIsRecurring(false);
    setRecurringInterval("monthly");
    setInvoiceNumber("");
    setSelectedReceiptFile(null);
    setReceiptUrl("");
    setModalOpen(true);
  };

  const handleOpenEdit = (tx: any) => {
    if (!isAdmin) {
      toast.error("Access denied. You do not have permissions to modify finances.");
      return;
    }
    setEditingTx(tx);
    setClientId(tx.client_id || "");
    setProjectId(tx.project_id || "");
    setType(tx.type);
    setCategory(tx.category);
    setAmount(tx.amount?.toString() || "");
    setCurrency(tx.currency || "TRY");
    setDescription(tx.description || "");
    setTransactionDate(tx.transaction_date || new Date().toISOString().split("T")[0]);
    setIsRecurring(tx.is_recurring || false);
    setRecurringInterval(tx.recurring_interval || "monthly");
    setInvoiceNumber(tx.invoice_number || "");
    setSelectedReceiptFile(null);
    setReceiptUrl(tx.receipt_url || "");
    setModalOpen(true);
  };

  // Handle receipt file upload directly to Supabase storage bucket "receipts"
  const handleReceiptUpload = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, "_");
      let filePath = `${Date.now()}_${cleanName}.${fileExt}`;
      filePath = filePath.replace(/^\/+/, "").replace(/\/+/g, "/");

      if (filePath.includes("undefined") || filePath.includes("null")) {
        throw new Error("Geçersiz dosya yolu: 'undefined' veya 'null' içeriyor.");
      }

      console.log("Upload Path:", filePath);

      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("bucket", "receipts");
      uploadFormData.append("path", filePath);

      const response = await uploadFileToServer(uploadFormData);

      console.log("Upload finished", response);

      if (response.error) {
        throw new Error(response.error);
      }

      return filePath;
    } catch (err: any) {
      console.error("Receipt upload error details:", err);
      toast.error(err.message || "Fiş yüklenirken hata oluştu");
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Lütfen geçerli bir miktar girin");
      return;
    }
    if (!category) {
      toast.error("Lütfen bir kategori seçin");
      return;
    }
    if (!transactionDate) {
      toast.error("İşlem tarihi zorunludur");
      return;
    }

    setIsPending(true);
    let finalReceiptUrl = receiptUrl;

    try {
      // Upload receipt if selected
      if (selectedReceiptFile) {
        finalReceiptUrl = await handleReceiptUpload(selectedReceiptFile);
      }

      const payload = {
        type,
        category,
        amount: parseFloat(amount),
        currency,
        description: description.trim() || null,
        client_id: clientId || null,
        project_id: projectId || null,
        transaction_date: transactionDate,
        is_recurring: isRecurring,
        recurring_interval: isRecurring ? recurringInterval : null,
        invoice_number: invoiceNumber.trim() || null,
        receipt_url: finalReceiptUrl || null,
      };

      if (editingTx) {
        // Edit Transaction
        const result = await updateTransaction(editingTx.id, payload);
        if (result.error) {
          // Clean up uploaded file if DB fails
          if (selectedReceiptFile && finalReceiptUrl) {
            await deleteFileFromServer("receipts", finalReceiptUrl);
          }
          toast.error(result.error);
        } else {
          toast.success("İşlem başarıyla güncellendi");
          setAllTransactions((prev) =>
            prev.map((t) =>
              t.id === editingTx.id
                ? {
                    ...t,
                    ...payload,
                    client: clients.find((c) => c.id === clientId),
                    project: projects.find((p) => p.id === projectId),
                  }
                : t
            )
          );
          setModalOpen(false);
        }
      } else {
        // Create Transaction
        const result = await createTransaction(payload);
        if (result.error) {
          // Clean up uploaded file if DB fails
          if (selectedReceiptFile && finalReceiptUrl) {
            await deleteFileFromServer("receipts", finalReceiptUrl);
          }
          toast.error(result.error);
        } else {
          toast.success("İşlem kaydedildi");
          const newRecord = {
            ...result.data,
            client: clients.find((c) => c.id === clientId),
            project: projects.find((p) => p.id === projectId),
          };
          setAllTransactions((prev) => [newRecord, ...prev]);
          setModalOpen(false);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "İşlem gerçekleştirilemedi");
    } finally {
      setIsPending(false);
    }
  };

  // Step 1: open the confirmation modal
  const handleDelete = (id: string, fileToClean: string | null) => {
    if (!isAdmin) return;
    setTransactionToDelete({ id, fileToClean });
    setIsDeleteModalOpen(true);
  };

  // Step 2: user confirmed — execute the actual deletion
  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    const { id, fileToClean } = transactionToDelete;

    setIsPending(true);
    try {
      const result = await deleteTransaction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("İşlem başarıyla silindi");
        setAllTransactions((prev) => prev.filter((t) => t.id !== id));
        if (fileToClean) {
          await deleteFileFromServer("receipts", fileToClean);
        }
        setIsDeleteModalOpen(false);
        setTransactionToDelete(null);
      }
    } catch (err: any) {
      toast.error(`Silme işlemi başarısız: ${err.message || err}`);
    } finally {
      setIsPending(false);
    }
  };

  // Optimistic inline update helper
  const handleInlineUpdate = async (txId: string, field: string, newValue: any) => {
    if (!isAdmin) return;

    setUpdatingRowIds((prev) => ({ ...prev, [txId]: true }));
    const originalTx = transactions.find((t) => t.id === txId);
    
    // Optimistic local state update
    setAllTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, [field]: newValue } : t))
    );

    try {
      const result = await updateTransaction(txId, { [field]: newValue });
      if (result.error) {
        toast.error(result.error);
        // Rollback state on error
        setAllTransactions((prev) =>
          prev.map((t) => (t.id === txId ? originalTx : t))
        );
      } else {
        toast.success("Transaction updated inline");
      }
    } catch (err) {
      toast.error("Failed to apply change");
      // Rollback state on exception
      setAllTransactions((prev) =>
        prev.map((t) => (t.id === txId ? originalTx : t))
      );
    } finally {
      setUpdatingRowIds((prev) => {
        const copy = { ...prev };
        delete copy[txId];
        return copy;
      });
    }
  };



  // Combined options lists for categories filter
  const allCategories = useMemo(() => {
    return [...TRANSACTION_CATEGORIES.income, ...TRANSACTION_CATEGORIES.expense];
  }, []);

  const getCategoryLabel = (type: "income" | "expense", val: string) => {
    const list = TRANSACTION_CATEGORIES[type];
    return list.find((c) => c.value === val)?.label || val;
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-card/40 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64 max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Açıklama, fatura, müşteri ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          {/* Type Filters */}
          <div className="flex bg-muted/40 p-1 rounded-xl border border-border/50 select-none">
            {[
              { val: "all", label: "Tüm İşlemler" },
              { val: "income", label: "Gelirler" },
              { val: "expense", label: "Giderler" },
            ].map((t) => (
              <button
                key={t.val}
                onClick={() => setTypeFilter(t.val)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                  typeFilter === t.val
                    ? "bg-card text-foreground shadow-sm border border-border/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="all">Tüm Kategoriler</option>
              <optgroup label="Gelir">
                {TRANSACTION_CATEGORIES.income.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Gider">
                {TRANSACTION_CATEGORIES.expense.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Right Create Action */}
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="h-10 px-4 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0 shadow-lg shadow-burgundy/10 w-full xl:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>İşlem Kaydet</span>
          </button>
        )}
      </div>

      {/* Ledger Table Grid */}
      {transactions.length === 0 ? (
        <EmptyState
          title="Kayıtlı işlem bulunamadı"
          description="Farklı filtreler uygulayın veya ilk gelir/gider kaydınızı oluşturun."
        />
      ) : (
        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[960px]">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="px-5 py-4 w-[120px]">Tarih</th>
                  <th className="px-5 py-4 w-[200px]">Açıklama</th>
                  <th className="px-5 py-4 w-[160px]">Müşteri / Proje</th>
                  <th className="px-5 py-4 w-[100px]">Tür</th>
                  <th className="px-5 py-4 w-[140px]">Kategori</th>
                  <th className="px-5 py-4 w-[140px]">Miktar</th>
                  <th className="px-5 py-4 w-[110px]">Tekrarlayan</th>
                  <th className="px-5 py-4 w-[140px] text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {transactions.map((tx) => {
                  const isUpdating = updatingRowIds[tx.id];
                  
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-muted/15 transition-colors group ${
                        isUpdating ? "opacity-60" : ""
                      }`}
                    >
                      {/* Date */}
                      <td className="px-5 py-4 font-semibold text-foreground/90 font-mono">
                        {formatDate(tx.transaction_date)}
                      </td>

                      {/* Description */}
                      <td className="px-5 py-4 font-medium text-foreground max-w-[200px] truncate select-all">
                        <div className="truncate font-semibold">{tx.description || "—"}</div>
                        {tx.invoice_number && (
                          <span className="text-[10px] text-muted-foreground/80 font-mono block mt-0.5">
                            Fatura: #{tx.invoice_number}
                          </span>
                        )}
                      </td>

                      {/* Client / Project */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground/85 truncate">
                          {tx.client ? tx.client.name : "—"}
                        </div>
                        {tx.project && (
                          <span className="text-[10px] text-muted-foreground/80 block mt-0.5 truncate">
                            Proje: {tx.project.name}
                          </span>
                        )}
                      </td>

                      {/* Type (Inline Toggleable for Admin) */}
                      <td className="px-5 py-4">
                        {isAdmin ? (
                          <button
                            disabled={isUpdating}
                            onClick={() =>
                              handleInlineUpdate(
                                tx.id,
                                "type",
                                tx.type === "income" ? "expense" : "income"
                              )
                            }
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border transition-all ${
                              tx.type === "income"
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                            }`}
                          >
                            {tx.type === "income" ? (
                              <>
                                <TrendingUp className="w-3 h-3 shrink-0" />
                                <span>Income</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-3 h-3 shrink-0" />
                                <span>Expense</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 border ${
                              tx.type === "income"
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            }`}
                          >
                            {tx.type === "income" ? "Income" : "Expense"}
                          </span>
                        )}
                      </td>

                      {/* Category (Inline Selectable for Admin) */}
                      <td className="px-5 py-4">
                        {isAdmin ? (
                          <select
                            disabled={isUpdating}
                            value={tx.category}
                            onChange={(e) =>
                              handleInlineUpdate(tx.id, "category", e.target.value)
                            }
                            className="bg-transparent border border-border/40 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-medium max-w-[140px] truncate"
                          >
                            {TRANSACTION_CATEGORIES[tx.type as "income" | "expense"].map(
                              (cat) => (
                                <option key={cat.value} value={cat.value} className="bg-card text-foreground">
                                  {cat.label}
                                </option>
                              )
                            )}
                          </select>
                        ) : (
                          <span className="font-semibold text-foreground/85">
                            {getCategoryLabel(tx.type, tx.category)}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td
                        className={`px-5 py-4 font-mono font-bold select-all ${
                          tx.type === "income" ? "text-emerald-400" : "text-foreground"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatCurrency(tx.amount, tx.currency)}
                      </td>

                      {/* Recurring Status */}
                      <td className="px-5 py-4">
                        {tx.is_recurring ? (
                          <span className="bg-burgundy/10 text-burgundy border border-burgundy/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider select-none">
                            {tx.recurring_interval}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30 font-medium select-none">—</span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          {tx.receipt_url && (
                            <a
                              href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/receipts/${tx.receipt_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0"
                              title="Fiş ekini görüntüle"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {tx.client_id && isAdmin && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await createInvoiceFromTransaction(tx.id);
                                  if (res.error) {
                                    toast.error(res.error);
                                  } else if (res.data?.id) {
                                    toast.success("Fatura başarıyla oluşturuldu.");
                                    router.push(`/finance/invoice/${res.data.id}`);
                                  }
                                } catch (err: any) {
                                  toast.error("Fatura oluşturulurken hata oluştu: " + err.message);
                                }
                              }}
                              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-emerald-400 hover:text-emerald-300 transition-all shrink-0"
                              title="Fatura Oluştur"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(tx)}
                                className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                                title="İşlemi düzenle"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(tx.id, tx.receipt_url)}
                                className="p-1.5 rounded-lg border border-border bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                                title="İşlemi sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 bg-card/45 px-6 py-4 rounded-b-2xl select-none">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1 || isTableLoading}
                  className="relative inline-flex items-center rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  Önceki
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages || isTableLoading}
                  className="relative ml-3 inline-flex items-center rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  Sonraki
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Toplam <span className="font-bold text-foreground font-mono">{totalCount}</span> işlemden{" "}
                    <span className="font-bold text-foreground font-mono">{(currentPage - 1) * 10 + 1}</span> ile{" "}
                    <span className="font-bold text-foreground font-mono">
                      {Math.min(currentPage * 10, totalCount)}
                    </span>{" "}
                    arası gösteriliyor
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm gap-1" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1 || isTableLoading}
                      className="relative inline-flex items-center rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                    >
                      <span className="sr-only">Önceki</span>
                      <span className="text-xs font-bold">Önceki</span>
                    </button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      const isCurrent = page === currentPage;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          disabled={isTableLoading}
                          className={cn(
                            "relative inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold font-mono transition-all cursor-pointer",
                            isCurrent
                              ? "bg-burgundy text-white shadow-md shadow-burgundy/25"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages || isTableLoading}
                      className="relative inline-flex items-center rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                    >
                      <span className="sr-only">Sonraki</span>
                      <span className="text-xs font-bold">Sonraki</span>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Add / Edit Dialog Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isPending && !isUploading && setModalOpen(false)}
          />

          <form
            onSubmit={handleSave}
            className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-burgundy" />
                <span>{editingTx ? "İşlem Kaydını Düzenle" : "İşlem Kaydet"}</span>
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isPending || isUploading}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Type, Category & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    İşlem Türü
                  </label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setType(newType);
                      // Reset to first category in category type list
                      setCategory(TRANSACTION_CATEGORIES[newType as "income" | "expense"][0].value);
                    }}
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  >
                    <option value="income">Gelir (+)</option>
                    <option value="expense">Gider (-)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Kategori
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  >
                    {TRANSACTION_CATEGORIES[type].map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount & Currency & Date */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Miktar
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isPending}
                      className="w-full h-10 pl-3 pr-16 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      disabled={isPending}
                      className="absolute right-2 top-1.2 h-7.5 px-2 bg-muted border border-border/80 text-[10px] font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Tarih
                  </label>
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
              </div>

              {/* Client & Project drop downs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    İlişkili Müşteri (İsteğe Bağlı)
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  >
                    <option value="">Müşteri seçin...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    İlişkili Proje (İsteğe Bağlı)
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  >
                    <option value="">Proje seçin...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description & Invoice */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Açıklama
                  </label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Monthly Retainer Invoice, Server License"
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Fatura No
                  </label>
                  <input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="LNX-2026-004"
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
              </div>

              {/* Recurring Settings */}
              <div className="grid grid-cols-2 gap-4 items-center bg-muted/15 border border-border/40 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="is-recurring"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    disabled={isPending}
                    className="w-4.5 h-4.5 rounded border-border text-burgundy focus:ring-burgundy accent-burgundy cursor-pointer"
                  />
                  <label
                    htmlFor="is-recurring"
                    className="text-xs font-bold text-foreground/80 cursor-pointer select-none"
                  >
                    Tekrarlayan İşlem
                  </label>
                </div>

                {isRecurring && (
                  <div className="space-y-1">
                    <select
                      value={recurringInterval}
                      onChange={(e) => setRecurringInterval(e.target.value as any)}
                      disabled={isPending}
                      className="w-full h-9 px-3 rounded-lg bg-input border border-border text-xs focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                    >
                      <option value="monthly">Her Ay</option>
                      <option value="quarterly">Her Çeyrek (3 Ay)</option>
                      <option value="yearly">Her Yıl</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Receipt File Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Belge Eki (Doğrudan Depolama)
                </label>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg,image/png,application/pdf"
                  disabled={isPending || isUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedReceiptFile(f);
                  }}
                />

                <div
                  onClick={() => !isPending && !isUploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 select-none ${
                    selectedReceiptFile || receiptUrl
                      ? "border-burgundy/60 bg-burgundy/5"
                      : "border-border hover:border-burgundy/40 hover:bg-muted/30"
                  }`}
                >
                  {selectedReceiptFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                          {selectedReceiptFile.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReceiptFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-muted"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : receiptUrl ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck className="w-5 h-5 text-burgundy shrink-0" />
                        <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                          Fiş Yüklendi ({receiptUrl.split("_").pop()})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReceiptUrl("");
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-muted"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <UploadCloud className="w-6 h-6 text-muted-foreground/80 mb-1" />
                      <p className="text-xs font-medium text-foreground">Fatura / Fiş yüklemek için tıklayın</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">JPEG, PNG veya PDF</p>
                    </div>
                  )}
                </div>

                {isUploading && (
                  <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-burgundy" />
                    <span>Belge depolama alanına yükleniyor...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isPending || isUploading}
                className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isPending || isUploading || !amount || parseFloat(amount) <= 0 || !category}
                className="h-10 px-5 rounded-xl gradient-burgundy text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
              >
                {isPending || isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>İşlem yapılıyor...</span>
                  </>
                ) : (
                  <span>{editingTx ? "Değişiklikleri Kaydet" : "Kaydet"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => { setIsDeleteModalOpen(false); setTransactionToDelete(null); }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl backdrop-blur-sm p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon + Title */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-destructive/15 shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">İşlemi Sil</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Bu işlem geri alınamaz.</p>
              </div>
            </div>

            {/* Body */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bu finansal kaydı <span className="font-semibold text-foreground">kalıcı olarak</span> silmek
              istediğinizden emin misiniz? Varsa ilişkili makbuz dosyası da depolama alanından kaldırılacaktır.
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => { setIsDeleteModalOpen(false); setTransactionToDelete(null); }}
                disabled={isPending}
                className="h-10 px-5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isPending}
                className="h-10 px-5 rounded-xl text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-2 transition-all shadow-md shadow-destructive/20 disabled:opacity-50"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Siliniyor...</span></>
                ) : (
                  <><Trash2 className="w-4 h-4" /><span>Evet, Sil</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
