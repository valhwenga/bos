import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, ReceiptText, TrendingDown } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Expense, ExpenseStore, DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expenseStore";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanySettingsStore } from "@/lib/companySettings";

const ExpenseDialog: React.FC<{ open: boolean; onOpenChange: (v:boolean)=>void; initial?: Expense; onSave: (e: Expense)=>void }>= ({ open, onOpenChange, initial, onSave }) => {
  const c = CompanySettingsStore.get();
  const [vendor, setVendor] = useState(initial?.vendor || "");
  const [category, setCategory] = useState(initial?.category || DEFAULT_EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<number>(initial?.amount || 0);
  const [tax, setTax] = useState<number>(initial?.tax || 0);
  const [date, setDate] = useState<string>(initial?.date || new Date().toISOString().slice(0,10));
  const [notes, setNotes] = useState<string>(initial?.notes || "");

  const save = () => {
    const e: Expense = {
      id: initial?.id || `exp_${Date.now()}`,
      vendor, category, amount, tax, date, notes,
      currencyCode: c.currencyCode,
    };
    onSave(e);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><label className="text-xs text-muted-foreground">Vendor</label><Input value={vendor} onChange={(e)=> setVendor(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_EXPENSE_CATEGORIES.map(cat=> <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Date</label><Input type="date" value={date} onChange={(e)=> setDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Amount ({c.currencySymbol})</label><Input type="number" min={0} value={amount} onChange={(e)=> setAmount(parseFloat(e.target.value||"0"))} /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Tax ({c.currencySymbol})</label><Input type="number" min={0} value={tax} onChange={(e)=> setTax(parseFloat(e.target.value||"0"))} /></div>
          </div>
          <div className="grid gap-1"><label className="text-xs text-muted-foreground">Notes</label><Input value={notes} onChange={(e)=> setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=> onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!vendor || amount<=0}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Expenses: React.FC = () => {
  const c = CompanySettingsStore.get();
  const [expenses, setExpenses] = useState(ExpenseStore.list());
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>(undefined);

  const filtered = expenses.filter(e =>
    (category==="all" || e.category===category)
    && (!q || e.vendor.toLowerCase().includes(q.toLowerCase()) || (e.notes||"").toLowerCase().includes(q.toLowerCase()))
    && (!from || e.date >= from) && (!to || e.date <= to)
  );

  const add = () => { setEditing(undefined); setDlgOpen(true); };
  const save = (e: Expense) => { editing ? ExpenseStore.update(e) : ExpenseStore.add(e); setExpenses(ExpenseStore.list()); };
  const del = (id: string) => {
    const ok = window.confirm("Delete this expense? This action cannot be undone.");
    if (!ok) return;
    ExpenseStore.remove(id);
    setExpenses(ExpenseStore.list());
  };

  const total = useMemo(() => filtered.reduce((s,e)=> s + (e.amount + (e.tax||0)), 0), [filtered]);

  const columns: Column<Expense>[] = [
    { id: "date", header: "Date", sortValue: (e) => e.date, cell: (e) => new Date(e.date).toLocaleDateString() },
    { id: "vendor", header: "Vendor", sortValue: (e) => e.vendor ?? "", cell: (e) => <span className="font-medium">{e.vendor || "—"}</span> },
    {
      id: "category",
      header: "Category",
      sortValue: (e) => e.category ?? "",
      cell: (e) => (
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{e.category || "Uncategorised"}</span>
      ),
    },
    {
      id: "notes",
      header: "Notes",
      hideOnMobile: true,
      cell: (e) => <span className="block max-w-xs truncate text-muted-foreground" title={e.notes}>{e.notes || "—"}</span>,
    },
    { id: "amount", header: "Amount", align: "right", hideOnMobile: true, sortValue: (e) => e.amount, cell: (e) => `${c.currencySymbol}${e.amount.toFixed(2)}` },
    { id: "tax", header: "Tax", align: "right", hideOnMobile: true, sortValue: (e) => e.tax ?? 0, cell: (e) => `${c.currencySymbol}${(e.tax || 0).toFixed(2)}` },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortValue: (e) => e.amount + (e.tax || 0),
      cell: (e) => <span className="font-medium">{c.currencySymbol}{(e.amount + (e.tax || 0)).toFixed(2)}</span>,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (e) => (
        <div className="inline-flex items-center justify-end gap-0.5" onClick={(ev) => ev.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(e); setDlgOpen(true); }} aria-label="Edit expense">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-danger" onClick={() => del(e.id)} aria-label="Delete expense">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const taxTotal = filtered.reduce((sum, e) => sum + (e.tax || 0), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Expenses"
        description="What the business has spent, and on what."
        breadcrumbs={[{ label: "Accounting", to: "/accounting/quotations" }, { label: "Expenses" }]}
        actions={<Button onClick={add}>Add expense</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Expenses" value={filtered.length} hint="Matching current filters" icon={ReceiptText} />
          <StatCard label="Total spend" value={`${c.currencySymbol}${total.toFixed(2)}`} hint="Including tax" icon={TrendingDown} tone="warning" />
          <StatCard label="Tax" value={`${c.currencySymbol}${taxTotal.toFixed(2)}`} hint="Recoverable where applicable" />
        </div>
      </PageHeader>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(e) => e.id}
        searchAccessor={(e) => `${e.vendor ?? ""} ${e.notes ?? ""} ${e.category ?? ""}`}
        searchPlaceholder="Search vendor, notes or category…"
        onRowClick={(e) => { setEditing(e); setDlgOpen(true); }}
        toolbar={
          <>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {DEFAULT_EXPENSE_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" aria-label="From date" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" aria-label="To date" />
          </>
        }
        empty={{
          title: "No expenses recorded",
          description: "Log what the business spends to keep income-versus-expense reporting accurate.",
          action: <Button onClick={add}>Add expense</Button>,
        }}
      />

      <ExpenseDialog open={dlgOpen} onOpenChange={(v)=> { setDlgOpen(v); if (!v) setExpenses(ExpenseStore.list()); }} initial={editing} onSave={save} />
    </div>
  );
};

export default Expenses;
