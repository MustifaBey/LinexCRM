"use client";

import { useState, useMemo } from "react";
import { createDomainRecord, updateDomainRecord, deleteDomainRecord } from "@/actions/domains";
import type { DomainRecord, Client } from "@/types/database";
import { StatusBadge } from "./status-badge";
import { daysUntil, formatCurrency, formatDate } from "@/lib/utils";
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Globe,
  Server,
  Key,
  Mail,
  X,
  Loader2,
  DollarSign,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "../shared/empty-state";

interface DomainTableProps {
  initialRecords: any[];
  clients: Client[];
}

export function DomainTable({ initialRecords, clients }: DomainTableProps) {
  const [records, setRecords] = useState<any[]>(initialRecords);
  const [search, setSearch] = useState("");
  const [selectedService, setSelectedService] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  
  // Dialog Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Form Fields
  const [clientId, setClientId] = useState("");
  const [serviceType, setServiceType] = useState<"domain" | "hosting" | "ssl" | "email">("domain");
  const [domainName, setDomainName] = useState("");
  const [provider, setProvider] = useState("");
  const [registrationDate, setRegistrationDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [annualCost, setAnnualCost] = useState("");
  const [notes, setNotes] = useState("");

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setClientId("");
    setServiceType("domain");
    setDomainName("");
    setProvider("");
    setRegistrationDate("");
    setExpirationDate("");
    setAutoRenew(false);
    setAnnualCost("");
    setNotes("");
    setModalOpen(true);
  };

  const handleOpenEdit = (rec: any) => {
    setEditingRecord(rec);
    setClientId(rec.client_id || "");
    setServiceType(rec.service_type);
    setDomainName(rec.domain_name);
    setProvider(rec.provider || "");
    setRegistrationDate(rec.registration_date || "");
    setExpirationDate(rec.expiration_date || "");
    setAutoRenew(rec.auto_renew || false);
    setAnnualCost(rec.annual_cost?.toString() || "");
    setNotes(rec.notes || "");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error("Please select a client");
      return;
    }
    if (!domainName.trim()) {
      toast.error("Domain/Service name is required");
      return;
    }
    if (!expirationDate) {
      toast.error("Expiration date is required");
      return;
    }

    setIsPending(true);
    try {
      const payload = {
        client_id: clientId,
        service_type: serviceType,
        domain_name: domainName.trim(),
        provider: provider.trim() || null,
        registration_date: registrationDate || null,
        expiration_date: expirationDate,
        auto_renew: autoRenew,
        annual_cost: annualCost ? parseFloat(annualCost) : null,
        notes: notes.trim() || null,
      };

      if (editingRecord) {
        // Edit record
        const result = await updateDomainRecord(editingRecord.id, payload);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Service record updated");
          setRecords((prev) =>
            prev.map((r) =>
              r.id === editingRecord.id
                ? {
                    ...r,
                    ...payload,
                    client: clients.find((c) => c.id === clientId),
                  }
                : r
            )
          );
          setModalOpen(false);
        }
      } else {
        // Create record
        const result = await createDomainRecord(payload);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Service record added");
          const newRecord = {
            ...result.data,
            client: clients.find((c) => c.id === clientId),
          };
          setRecords((prev) => [newRecord, ...prev]);
          setModalOpen(false);
        }
      }
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message || err}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    setIsPending(true);
    try {
      const result = await deleteDomainRecord(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Record deleted");
        setRecords((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message || err}`);
    } finally {
      setIsPending(false);
    }
  };

  // Filter logic
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // Service filter
    if (selectedService !== "all") {
      result = result.filter((r) => r.service_type === selectedService);
    }

    // Status filter (Safe: >30, Warning: <=30 && >=0, Expired: <0)
    if (selectedStatus !== "all") {
      result = result.filter((r) => {
        const days = daysUntil(r.expiration_date);
        if (selectedStatus === "safe") return days > 30;
        if (selectedStatus === "warning") return days >= 0 && days <= 30;
        if (selectedStatus === "expired") return days < 0;
        return true;
      });
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.domain_name.toLowerCase().includes(q) ||
          r.provider?.toLowerCase().includes(q) ||
          r.client?.name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [records, search, selectedService, selectedStatus]);

  // Service icons mapping
  const serviceIcons = {
    domain: <Globe className="w-4 h-4 text-sky-400" />,
    hosting: <Server className="w-4 h-4 text-emerald-400" />,
    ssl: <Key className="w-4 h-4 text-amber-400" />,
    email: <Mail className="w-4 h-4 text-purple-400" />,
  };

  return (
    <div className="space-y-6">
      {/* Filters and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card/40 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
        {/* Left Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64 max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search services, provider, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          {/* Service Type Tab Filters */}
          <div className="flex bg-muted/40 p-1 rounded-xl border border-border/50">
            {["all", "domain", "hosting", "ssl", "email"].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedService(type)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  selectedService === type
                    ? "bg-card text-foreground shadow-sm border border-border/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Expiry Alarm Status Filters */}
          <div className="flex bg-muted/40 p-1 rounded-xl border border-border/50">
            {[
              { val: "all", label: "All Alarms" },
              { val: "safe", label: "Safe" },
              { val: "warning", label: "Warning" },
              { val: "expired", label: "Expired" },
            ].map((st) => (
              <button
                key={st.val}
                onClick={() => setSelectedStatus(st.val)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                  selectedStatus === st.val
                    ? "bg-card text-foreground shadow-sm border border-border/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Actions */}
        <button
          onClick={handleOpenCreate}
          className="h-10 px-4 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0 shadow-lg shadow-burgundy/10 w-full lg:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add Service Record</span>
        </button>
      </div>

      {/* Ledger Table */}
      {filteredRecords.length === 0 ? (
        <EmptyState
          title="No domain records found"
          description="Clear your filters or add a new record to begin tracking domain renewals."
          action={
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Service Record</span>
            </button>
          }
        />
      ) : (
        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="px-5 py-4">Client</th>
                  <th className="px-5 py-4">Service</th>
                  <th className="px-5 py-4">Provider</th>
                  <th className="px-5 py-4">Registration</th>
                  <th className="px-5 py-4">Expiration</th>
                  <th className="px-5 py-4">Annual Cost</th>
                  <th className="px-5 py-4">Alarm Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-muted/15 transition-colors group"
                  >
                    {/* Client cell */}
                    <td className="px-5 py-4.5">
                      <div className="font-semibold text-foreground">
                        {rec.client?.name || "Unassigned"}
                      </div>
                      {rec.client?.company && (
                        <div className="text-[11px] text-muted-foreground">
                          {rec.client.company}
                        </div>
                      )}
                    </td>

                    {/* Service Name cell */}
                    <td className="px-5 py-4.5">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-muted border border-border/40 shrink-0">
                          {serviceIcons[rec.service_type as "domain" | "hosting" | "ssl" | "email"]}
                        </span>
                        <div>
                          <div className="font-semibold text-foreground select-all leading-tight">
                            {rec.domain_name}
                          </div>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                            {rec.service_type}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Provider cell */}
                    <td className="px-5 py-4.5 font-medium text-foreground/80">
                      {rec.provider || "—"}
                    </td>

                    {/* Registration cell */}
                    <td className="px-5 py-4.5 text-xs text-muted-foreground">
                      {rec.registration_date ? formatDate(rec.registration_date) : "—"}
                    </td>

                    {/* Expiration cell */}
                    <td className="px-5 py-4.5 font-semibold text-foreground/90">
                      {formatDate(rec.expiration_date)}
                    </td>

                    {/* Annual Cost cell */}
                    <td className="px-5 py-4.5 font-mono text-xs text-foreground/80">
                      {rec.annual_cost !== null
                        ? formatCurrency(rec.annual_cost)
                        : "—"}
                    </td>

                    {/* Status Badge cell */}
                    <td className="px-5 py-4.5">
                      <StatusBadge
                        expirationDate={rec.expiration_date}
                        autoRenew={rec.auto_renew}
                      />
                    </td>

                    {/* Actions cell */}
                    <td className="px-5 py-4.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                          title="Edit record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="p-1.5 rounded-lg border border-border bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit/Create Dialog Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isPending && setModalOpen(false)}
          />

          <form
            onSubmit={handleSave}
            className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5 text-burgundy" />
                <span>{editingRecord ? "Edit Service Record" : "Add Service Record"}</span>
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isPending}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Client & Service row */}
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
                    <option value="">Select a client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Service Type
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as any)}
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  >
                    <option value="domain">Domain Name</option>
                    <option value="hosting">Hosting Server</option>
                    <option value="ssl">SSL Certificate</option>
                    <option value="email">Professional Email</option>
                  </select>
                </div>
              </div>

              {/* Name & Provider row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Service Domain/Name
                  </label>
                  <input
                    value={domainName}
                    onChange={(e) => setDomainName(e.target.value)}
                    placeholder="example.com"
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Provider
                  </label>
                  <input
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="Cloudflare, GoDaddy"
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
              </div>

              {/* Dates row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Registration Date
                  </label>
                  <input
                    type="date"
                    value={registrationDate}
                    onChange={(e) => setRegistrationDate(e.target.value)}
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
              </div>

              {/* Cost & Auto-renew row */}
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Annual Cost (TRY)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={annualCost}
                    onChange={(e) => setAnnualCost(e.target.value)}
                    placeholder="0.00"
                    disabled={isPending}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="auto-renew"
                    checked={autoRenew}
                    onChange={(e) => setAutoRenew(e.target.checked)}
                    disabled={isPending}
                    className="w-4.5 h-4.5 rounded border-border text-burgundy focus:ring-burgundy accent-burgundy"
                  />
                  <label
                    htmlFor="auto-renew"
                    className="text-xs font-semibold text-foreground/80 cursor-pointer select-none"
                  >
                    Enable Auto-Renewal
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Billing details, registrar credentials location, API tokens notes..."
                  rows={3}
                  disabled={isPending}
                  className="w-full p-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isPending}
                className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !clientId || !domainName.trim() || !expirationDate}
                className="h-10 px-5 rounded-xl gradient-burgundy text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{editingRecord ? "Save Changes" : "Create Record"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
