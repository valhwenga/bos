import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, FileMinus, Wallet } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { CreditNotesStore, type CreditNote } from "@/lib/creditNotesStore";
import { previewNextNumber, resolveNumberOnSave } from "@/lib/documentNumbers";
import { AccountingStore } from "@/lib/accountingStore";
import { CompanySettingsStore } from "@/lib/companySettings";

const NewCreditDialog: React.FC<{ open: boolean; onOpenChange: (v:boolean)=>void; onSaved: ()=>void }> = ({ open, onOpenChange, onSaved }) => {
  const customers = useMemo(() => AccountingStore.listInvoices().map(i=> i.customer)
    .concat(AccountingStore.listQuotes().map(q=> q.customer))
    .reduce((acc, cur)=> acc.find(x=> x.id===cur.id) ? acc : acc.concat(cur), [] as {id:string; name:string}[]), []);
  const [number, setNumber] = useState(() => previewNextNumber("credit_note"));
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || "");
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  const save = () => {
    if (!customerId || amount<=0) return;
    const custName = customers.find(c=> c.id===customerId)?.name;
    // Allocated here rather than on open, so cancelling the dialog does not
    // consume a number and leave a gap.
    const allocated = resolveNumberOnSave("credit_note", number, previewNextNumber("credit_note"));
    const cn: CreditNote = { id: `cn_${Date.now()}`, number: allocated, date, customerId, customerName: custName, amount, applied: [], notes, createdAt: new Date().toISOString() };
    CreditNotesStore.upsert(cn);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Credit Note</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Number</label><Input value={number} readOnly /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Date</label><Input type="date" value={date} onChange={(e)=> setDate(e.target.value)} /></div>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Customer</label>
            <select className="border rounded px-2 py-2 text-sm" value={customerId} onChange={(e)=> setCustomerId(e.target.value)}>
              {customers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Amount</label><Input type="number" min={0} value={amount} onChange={(e)=> setAmount(parseFloat(e.target.value||"0"))} /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Notes</label><Input value={notes} onChange={(e)=> setNotes(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=> onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!customerId || amount<=0}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ApplyDialog: React.FC<{ open: boolean; onOpenChange: (v:boolean)=>void; credit?: CreditNote; onSaved: ()=>void }> = ({ open, onOpenChange, credit, onSaved }) => {
  const c = CompanySettingsStore.get();
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  useEffect(()=> { setAlloc({}); }, [credit?.id]);
  const invoices = useMemo(()=> AccountingStore.listInvoices().filter(i=> i.customer.id===credit?.customerId), [credit?.customerId]);

  const remaining = useMemo(() => {
    const applied = Object.values(alloc).reduce((s,v)=> s+ (v||0), 0);
    return Math.max(0, (credit?.amount||0) - applied);
  }, [alloc, credit?.amount]);

  const save = () => {
    if (!credit) return;
    const applied = Object.entries(alloc).filter(([,a])=> (a||0)>0).map(([invoiceId, amount])=> ({ invoiceId, amount }));
    const merged = [...(credit.applied||[])];
    applied.forEach(a=> {
      const i = merged.findIndex(x=> x.invoiceId===a.invoiceId);
      if (i>=0) merged[i] = { invoiceId: a.invoiceId, amount: (merged[i].amount||0) + a.amount };
      else merged.push(a);
    });
    CreditNotesStore.upsert({ ...credit, applied: merged });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Apply Credit</DialogTitle></DialogHeader>
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>No.</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="text-right">Apply</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(i=> {
                const sub = i.items.reduce((s,it)=> s+it.qty*it.price, 0);
                const paid = 0; // could pull from PaymentStore if needed for more accurate outstanding
                const outstanding = Math.max(0, sub - paid);
                const key = i.id;
                const val = alloc[key] || 0;
                return (
                  <TableRow key={i.id}>
                    <TableCell>{i.number}</TableCell>
                    <TableCell>{new Date(i.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{c.currencySymbol}{outstanding.toFixed(2)}</TableCell>
                    <TableCell className="text-right"><Input className="text-right" type="number" min={0} value={val} onChange={(e)=> setAlloc(prev => ({ ...prev, [key]: parseFloat(e.target.value||"0") }))} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="text-sm">Remaining to allocate: <span className="font-semibold">{c.currencySymbol}{remaining.toFixed(2)}</span></div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=> onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CreditNotes: React.FC = () => {
  const cs = CompanySettingsStore.get();
  const [list, setList] = useState(CreditNotesStore.list());
  const [open, setOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [active, setActive] = useState<CreditNote | undefined>(undefined);

  useEffect(() => {
    const refresh = () => setList(CreditNotesStore.list());
    const onStorage = (e: StorageEvent) => { if (e.key && e.key.startsWith('acct.credits')) refresh(); };
    window.addEventListener('acct.credits-changed', refresh as any);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('acct.credits-changed', refresh as any); window.removeEventListener('storage', onStorage); };
  }, []);

  const appliedSum = (cn: CreditNote) => (cn.applied||[]).reduce((s,a)=> s+a.amount, 0);

  const remainingFor = (cn: CreditNote) => Math.max(0, (cn.amount || 0) - appliedSum(cn));

  const columns: Column<CreditNote>[] = [
    { id: "number", header: "No.", sortValue: (cn) => cn.number, cell: (cn) => <span className="font-medium">{cn.number}</span> },
    { id: "date", header: "Date", sortValue: (cn) => cn.date, cell: (cn) => new Date(cn.date).toLocaleDateString() },
    { id: "customer", header: "Customer", sortValue: (cn) => cn.customerName ?? "", cell: (cn) => cn.customerName || cn.customerId },
    { id: "amount", header: "Amount", align: "right", hideOnMobile: true, sortValue: (cn) => cn.amount ?? 0, cell: (cn) => `${cs.currencySymbol}${(cn.amount || 0).toFixed(2)}` },
    { id: "applied", header: "Applied", align: "right", hideOnMobile: true, sortValue: appliedSum, cell: (cn) => `${cs.currencySymbol}${appliedSum(cn).toFixed(2)}` },
    {
      id: "remaining",
      header: "Remaining",
      align: "right",
      sortValue: remainingFor,
      cell: (cn) => (
        <span className={remainingFor(cn) > 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
          {cs.currencySymbol}{remainingFor(cn).toFixed(2)}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (cn) => (
        <div className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="h-8" onClick={() => { setActive(cn); setApplyOpen(true); }}>
            Apply
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-danger"
            aria-label={`Delete credit note ${cn.number}`}
            onClick={() => {
              if (!window.confirm(`Delete credit note ${cn.number}? This cannot be undone.`)) return;
              CreditNotesStore.remove(cn.id);
              setList(CreditNotesStore.list());
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const unapplied = list.reduce((sum, cn) => sum + remainingFor(cn), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Credit notes"
        description="Credits owed back to customers, and how much of each is still unused."
        breadcrumbs={[{ label: "Accounting", to: "/accounting/quotations" }, { label: "Credit notes" }]}
        actions={<Button onClick={() => setOpen(true)}>New credit note</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Credit notes" value={list.length} hint="All time" icon={FileMinus} />
          <StatCard
            label="Unapplied credit"
            value={`${cs.currencySymbol}${unapplied.toFixed(2)}`}
            hint={unapplied > 0 ? "Still owed to customers" : "All credit applied"}
            icon={Wallet}
            tone={unapplied > 0 ? "warning" : "success"}
          />
        </div>
      </PageHeader>

      <DataTable
        rows={list}
        columns={columns}
        rowKey={(cn) => cn.id}
        searchAccessor={(cn) => `${cn.number} ${cn.customerName ?? ""} ${cn.customerId ?? ""}`}
        searchPlaceholder="Search by number or customer…"
        empty={{
          title: "No credit notes",
          description: "Raise a credit note when you need to refund or discount an issued invoice.",
          action: <Button onClick={() => setOpen(true)}>New credit note</Button>,
        }}
      />

      <NewCreditDialog open={open} onOpenChange={(v)=> { setOpen(v); if (!v) setList(CreditNotesStore.list()); }} onSaved={()=> setList(CreditNotesStore.list())} />
      <ApplyDialog open={applyOpen} onOpenChange={(v)=> { setApplyOpen(v); if (!v) { setActive(undefined); setList(CreditNotesStore.list()); } }} credit={active} onSaved={()=> setList(CreditNotesStore.list())} />
    </div>
  );
};

export default CreditNotes;
