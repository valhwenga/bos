import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const del = (id: string) => { ExpenseStore.remove(id); setExpenses(ExpenseStore.list()); };

  const total = useMemo(() => filtered.reduce((s,e)=> s + (e.amount + (e.tax||0)), 0), [filtered]);

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Expenses</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Search vendor/notes" value={q} onChange={(e)=> setQ(e.target.value)} className="w-56" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {DEFAULT_EXPENSE_CATEGORIES.map(cat=> <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e)=> setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e)=> setTo(e.target.value)} />
            <Button onClick={add}>Add Expense</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e=> (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                    <TableCell>{e.vendor}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="max-w-[260px] truncate" title={e.notes}>{e.notes}</TableCell>
                    <TableCell className="text-right">{c.currencySymbol}{e.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{c.currencySymbol}{(e.tax||0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{c.currencySymbol}{(e.amount + (e.tax||0)).toFixed(2)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="secondary" onClick={()=> { setEditing(e); setDlgOpen(true); }}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={()=> del(e.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end text-sm mt-2"><span className="mr-2">Total:</span><span className="font-semibold">{c.currencySymbol}{total.toFixed(2)}</span></div>
        </CardContent>
      </Card>
      <ExpenseDialog open={dlgOpen} onOpenChange={(v)=> { setDlgOpen(v); if (!v) setExpenses(ExpenseStore.list()); }} initial={editing} onSave={save} />
    </div>
  );
};

export default Expenses;
