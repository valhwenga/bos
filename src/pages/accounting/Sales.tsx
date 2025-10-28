import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    window.addEventListener('acct.sales-changed', refresh as any);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('acct.sales-changed', refresh as any); window.removeEventListener('storage', onStorage); };
  }, []);

  const total = useMemo(() => (s: Sale) => s.items.reduce((sum, i)=> sum + i.qty*i.price, 0), []);

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Sales</CardTitle>
          <Button onClick={()=> setOpen(true)}>New Sale</Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{s.number}</TableCell>
                    <TableCell>{new Date(s.date).toLocaleDateString()}</TableCell>
                    <TableCell>{s.customerName || '-'}</TableCell>
                    <TableCell className="text-right">{cs.currencySymbol}{total(s).toFixed(2)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="destructive" onClick={()=> { SalesStore.remove(s.id); setList(SalesStore.list()); }}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SalesDialog open={open} onOpenChange={(v)=> { setOpen(v); if (!v) setList(SalesStore.list()); }} onSaved={()=> setList(SalesStore.list())} />
    </div>
  );
};

export default Sales;
