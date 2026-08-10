import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, ShoppingBag, TrendingUp } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { SalesStore, type Sale, type SaleItem } from "@/lib/salesStore";
import { ProductsStore } from "@/lib/productsStore";
import { CompanySettingsStore } from "@/lib/companySettings";

const SalesDialog: React.FC<{ open: boolean; onOpenChange: (v:boolean)=>void; onSaved: ()=>void }> = ({ open, onOpenChange, onSaved }) => {
  const products = ProductsStore.list();
  const [number] = useState(`S-${new Date().getFullYear()}-${Math.floor(Math.random()*9000+1000)}`);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [customerName, setCustomerName] = useState<string>("");
  const [method, setMethod] = useState<string>("Cash");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [items, setItems] = useState<SaleItem[]>([{ id: `si_${Date.now()}`, name: products[0]?.name || "Item", qty: 1, price: products[0]?.price || 0, description: products[0]?.description || "" }]);

  const addItem = () => setItems(prev => [...prev, { id: `si_${Date.now()}`, name: products[0]?.name || "Item", qty: 1, price: products[0]?.price || 0, description: products[0]?.description || "" }]);
  const removeItem = (id: string) => setItems(prev => prev.filter(i=> i.id!==id));
  const updateItem = (id: string, patch: Partial<SaleItem>) => setItems(prev => prev.map(i=> i.id===id ? { ...i, ...patch } : i));

  const total = useMemo(() => items.reduce((s,i)=> s + i.qty*i.price, 0), [items]);

  const save = () => {
    if (items.length===0 || items.some(i=> !i.name.trim())) return;
    const sale: Sale = { id: `s_${Date.now()}`, number, date, customerName: customerName || undefined, items, method, reference, notes, createdAt: new Date().toISOString() };
    SalesStore.upsert(sale);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New Sale</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Number</label><Input value={number} readOnly /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Date</label><Input type="date" value={date} onChange={(e)=> setDate(e.target.value)} /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Customer (optional)</label><Input value={customerName} onChange={(e)=> setCustomerName(e.target.value)} placeholder="Walk-in / Company" /></div>
          </div>
          <div className="rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(it => (
                  <TableRow key={it.id}>
                    <TableCell><Input value={it.name} onChange={(e)=> updateItem(it.id, { name: e.target.value })} /></TableCell>
                    <TableCell><Input value={it.description||""} onChange={(e)=> updateItem(it.id, { description: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" min={0} value={it.qty} onChange={(e)=> updateItem(it.id, { qty: parseFloat(e.target.value||"0") })} /></TableCell>
                    <TableCell><Input type="number" min={0} value={it.price} onChange={(e)=> updateItem(it.id, { price: parseFloat(e.target.value||"0") })} /></TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="destructive" onClick={()=> removeItem(it.id)}>Remove</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-2"><Button size="sm" onClick={addItem}>Add Item</Button></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Method</label><Input value={method} onChange={(e)=> setMethod(e.target.value)} placeholder="Cash / Card / EFT" /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Reference</label><Input value={reference} onChange={(e)=> setReference(e.target.value)} placeholder="POS ref / Bank ref" /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Notes</label><Input value={notes} onChange={(e)=> setNotes(e.target.value)} /></div>
          </div>
          <div className="text-right font-semibold">Total: {CompanySettingsStore.get().currencySymbol}{total.toFixed(2)}</div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=> onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={items.length===0}>Save Sale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Sales: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(SalesStore.list());
  const cs = CompanySettingsStore.get();

  useEffect(() => {
    const refresh = () => setList(SalesStore.list());
    const onStorage = (e: StorageEvent) => { if (e.key && e.key.startsWith('acct.sales')) refresh(); };
    window.addEventListener('acct.sales-changed', refresh);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('acct.sales-changed', refresh); window.removeEventListener('storage', onStorage); };
  }, []);

  const total = useMemo(() => (s: Sale) => s.items.reduce((sum, i) => sum + i.qty * i.price, 0), []);

  const columns: Column<Sale>[] = [
    { id: "number", header: "No.", sortValue: (s) => s.number, cell: (s) => <span className="font-medium">{s.number}</span> },
    { id: "date", header: "Date", sortValue: (s) => s.date, cell: (s) => new Date(s.date).toLocaleDateString() },
    { id: "customer", header: "Customer", sortValue: (s) => s.customerName ?? "", cell: (s) => s.customerName || <span className="text-subtle">—</span> },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortValue: total,
      cell: (s) => <span className="font-medium">{cs.currencySymbol}{total(s).toFixed(2)}</span>,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (s) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-danger"
            aria-label={`Delete sale ${s.number}`}
            onClick={() => {
              if (!window.confirm(`Delete sale ${s.number}? This cannot be undone.`)) return;
              SalesStore.remove(s.id);
              setList(SalesStore.list());
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const revenue = list.reduce((sum, s) => sum + total(s), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Sales"
        description="Direct sales recorded outside the quote-to-invoice flow."
        breadcrumbs={[{ label: "Accounting", to: "/accounting/quotations" }, { label: "Sales" }]}
        actions={<Button onClick={() => setOpen(true)}>New sale</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Sales" value={list.length} hint="All time" icon={ShoppingBag} />
          <StatCard label="Value" value={`${cs.currencySymbol}${revenue.toFixed(2)}`} hint="Sum of all sales" icon={TrendingUp} tone="success" />
        </div>
      </PageHeader>

      <DataTable
        rows={list}
        columns={columns}
        rowKey={(s) => s.id}
        searchAccessor={(s) => `${s.number} ${s.customerName ?? ""}`}
        searchPlaceholder="Search by number or customer…"
        empty={{
          title: "No sales recorded",
          description: "Record a direct sale when there's no quote or invoice behind it.",
          action: <Button onClick={() => setOpen(true)}>New sale</Button>,
        }}
      />

      <SalesDialog open={open} onOpenChange={(v)=> { setOpen(v); if (!v) setList(SalesStore.list()); }} onSaved={()=> setList(SalesStore.list())} />
    </div>
  );
};

export default Sales;
