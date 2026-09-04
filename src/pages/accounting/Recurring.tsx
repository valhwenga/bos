import React, { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { useCache } from "@/lib/collectionCache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2, Repeat, Play, Pause } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { recurringCache, RecurringStore, type RecurringTemplate, type RecurringCadence } from "@/lib/recurringStore";
import { CustomersStore } from "@/lib/customersStore";
import { CompanySettingsStore } from "@/lib/companySettings";
import { AccountingStore } from "@/lib/accountingStore";
import { EmailStore } from "@/lib/emailStore";
import { canAccess } from "@/lib/accessControl";

const NewRecurringDialog: React.FC<{ open: boolean; onOpenChange: (v:boolean)=>void; onSaved: ()=>void; editing?: RecurringTemplate }> = ({ open, onOpenChange, onSaved, editing }) => {
  const customers = CustomersStore.list();
  const [name, setName] = useState(editing?.name || "");
  const [customerId, setCustomerId] = useState<string>(editing?.customer.id || customers[0]?.id || "");
  const [cadence, setCadence] = useState<RecurringCadence>(editing?.cadence || "monthly");
  const [intervalDays, setIntervalDays] = useState<number>(editing?.intervalDays || 30);
  const [startDate, setStartDate] = useState<string>(editing?.startDate || new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string | undefined>(editing?.endDate);
  const [timeOfDay, setTimeOfDay] = useState<string>(editing?.timeOfDay || "09:00");
  const [autoSend, setAutoSend] = useState<boolean>(editing?.autoSend ?? true);
  const [active, setActive] = useState<boolean>(editing?.active ?? true);
  const [notes, setNotes] = useState<string>(editing?.notes || "");
  const [seqPrefix, setSeqPrefix] = useState<string>(editing?.seqPrefix || "INV-");
  const [nextNumber, setNextNumber] = useState<number>(editing?.nextNumber || 1);
  const [items, setItems] = useState(editing?.items || [{ id: `ri_${Date.now()}`, name: "Service Retainer", qty: 1, price: 0 }]);

  const addItem = () => setItems(prev => [...prev, { id: `ri_${Date.now()}`, name: "Service Retainer", qty: 1, price: 0 }]);
  const removeItem = (id: string) => setItems(prev => prev.filter(i=> i.id!==id));
  const updateItem = (id: string, patch: Partial<typeof items[number]>) => setItems(prev => prev.map(i=> i.id===id ? { ...i, ...patch } : i));

  const computeInitialNextRun = (): string => {
    const base = new Date(`${startDate}T${timeOfDay}:00`);
    const now = Date.now();
    const t = base;
    const advance = () => {
      switch (cadence) {
        case 'weekly': t.setDate(t.getDate()+7); break;
        case 'monthly': t.setMonth(t.getMonth()+1); break;
        case 'quarterly': t.setMonth(t.getMonth()+3); break;
        case 'yearly': t.setFullYear(t.getFullYear()+1); break;
        case 'customDays': default: t.setDate(t.getDate() + (intervalDays||30)); break;
      }
    };
    while (t.getTime() < now) advance();
    return t.toISOString();
  };

  useEffect(()=> {
    if (!editing) {
      // reset to defaults on open
      if (open) {
        setName("");
        setCustomerId(customers[0]?.id || "");
        setCadence("monthly");
        setIntervalDays(30);
        setStartDate(new Date().toISOString().slice(0,10));
        setEndDate(undefined);
        setTimeOfDay("09:00");
        setAutoSend(true);
        setActive(true);
        setNotes("");
        setItems([{ id: `ri_${Date.now()}`, name: "Service Retainer", qty: 1, price: 0 }]);
      }
    }
  }, [open]);

  const save = async () => {
    if (!name.trim() || !customerId || items.length===0) return;
    const customer = customers.find(c=> c.id===customerId)!;
    const nextRunAt = editing?.nextRunAt || computeInitialNextRun();
    const tpl: RecurringTemplate = {
      id: editing?.id || `rec_${Date.now()}`,
      name: name.trim(),
      customer: customer,
      items,
      cadence,
      intervalDays: cadence==='customDays'? intervalDays : undefined,
      startDate,
      endDate,
      timeOfDay,
      nextRunAt,
      active,
      autoSend,
      notes,
      createdAt: editing?.createdAt || new Date().toISOString(),
      lastRunAt: editing?.lastRunAt,
      seqPrefix: seqPrefix || undefined,
      nextNumber: nextNumber || 1,
    };
    try {
      await RecurringStore.upsert(tpl);
    } catch (err) {
      toast({
        title: "Could not save template",
        description: err instanceof Error ? err.message : "Nothing was saved.",
        variant: "destructive",
      });
      return;
    }
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{editing ? 'Edit Recurring' : 'New Recurring'}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Name</label><Input value={name} onChange={(e)=> setName(e.target.value)} placeholder="SLA/Retainer" /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Customer</label>
              <select className="border rounded px-2 py-2 text-sm" value={customerId} onChange={(e)=> setCustomerId(e.target.value)}>
                {customers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Cadence</label>
              <select className="border rounded px-2 py-2 text-sm" value={cadence} onChange={(e)=> setCadence(e.target.value as RecurringCadence)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="customDays">Custom (days)</option>
              </select>
            </div>
            {cadence==='customDays' && (
              <div className="grid gap-1"><label className="text-xs text-muted-foreground">Every (days)</label><Input type="number" min={1} value={intervalDays} onChange={(e)=> setIntervalDays(parseInt(e.target.value||'1',10))} /></div>
            )}
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Time of day</label><Input type="time" value={timeOfDay} onChange={(e)=> setTimeOfDay(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Start date</label><Input type="date" value={startDate} onChange={(e)=> setStartDate(e.target.value)} /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">End date</label><Input type="date" value={endDate||""} onChange={(e)=> setEndDate(e.target.value||undefined)} /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Auto send</label><input type="checkbox" checked={autoSend} onChange={(e)=> setAutoSend(e.target.checked)} /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Seq Prefix</label><Input value={seqPrefix} onChange={(e)=> setSeqPrefix(e.target.value)} placeholder="INV-" /></div>
            <div className="grid gap-1"><label className="text-xs text-muted-foreground">Next Number</label><Input type="number" min={1} value={nextNumber} onChange={(e)=> setNextNumber(parseInt(e.target.value||'1',10))} /></div>
          </div>
          <div className="rounded border mt-2">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Item</TableHead><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
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
          <div className="grid gap-1"><label className="text-xs text-muted-foreground">Notes</label><Input value={notes} onChange={(e)=> setNotes(e.target.value)} /></div>
          <div className="grid gap-1"><label className="text-xs text-muted-foreground">Active</label><input type="checkbox" checked={active} onChange={(e)=> setActive(e.target.checked)} /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=> onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={!name.trim() || !customerId || items.length===0}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Recurring: React.FC = () => {
  const cs = CompanySettingsStore.get();
  // Rows come from Postgres via a cache, so this re-renders when they arrive.
  const { rows: list } = useCache(recurringCache);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTemplate | undefined>(undefined);

  useEffect(() => {
    const refresh = () => void recurringCache.refresh();
    const onStorage = (e: StorageEvent) => { if (e.key && e.key.startsWith('acct.recurring')) refresh(); };
    window.addEventListener('acct.recurring-changed', refresh as any);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('acct.recurring-changed', refresh as any); window.removeEventListener('storage', onStorage); };
  }, []);

  const total = useMemo(() => (t: RecurringTemplate) => t.items.reduce((s,i)=> s + i.qty*i.price, 0), []);

  const runNow = async (t: RecurringTemplate) => {
    if (!canAccess('accounting', 'full')) { alert('Requires manager approval (Accounting: Full).'); return; }
    const ok = window.confirm(`Generate and send invoice for template "${t.name}" now?`);
    if (!ok) return;
    const cs = CompanySettingsStore.get();
    const num = `${t.seqPrefix || 'INV-'}${String(t.nextNumber || 1).padStart(4,'0')}`;
    const inv = {
      id: `inv_${Date.now()}`,
      number: num,
      customer: t.customer,
      items: t.items,
      status: 'sent' as const,
      createdAt: new Date().toISOString(),
      useShippingAddress: false,
    };
    // Awaited: if the invoice does not save, the template must not advance its
    // schedule, or the period is billed nowhere and never retried.
    await AccountingStore.upsertInvoice(inv as any);
    // Also awaited: the invoice exists now, so failing to advance the schedule
    // would bill the same period again on the next run.
    await RecurringStore.upsert({ ...t, lastRunAt: new Date().toISOString(), nextRunAt: RecurringStore.computeNextRun(t), nextNumber: (t.nextNumber || 1) + 1 });
    try {
      if (t.autoSend && t.customer.email) {
        const subject = `Invoice ${inv.number} from ${cs.name || 'Our Company'}`;
        const body = `Dear ${t.customer.name},\n\nPlease find attached your invoice ${inv.number}.\n\nRegards,\n${cs.name || 'Our Company'}`;
        // Bundled, so a recurring invoice still sends when the CDN is blocked.
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('p','mm','a4');
        let y = 15; pdf.setFontSize(16); pdf.text(`Invoice ${inv.number}`, 15, y); y+=8;
        pdf.setFontSize(11); pdf.text(`Date: ${new Date(inv.createdAt).toLocaleDateString()}`, 15, y); y+=6;
        pdf.text(`Bill To: ${t.customer.name}`, 15, y); y+=8;
        pdf.setFontSize(12); pdf.text('Items', 15, y); y+=6; pdf.setFontSize(11);
        let tot = 0; t.items.forEach((it:any)=> { pdf.text(`${it.name}  ${it.qty} x ${it.price.toFixed(2)}`, 20, y); y+=6; tot += (it.qty||0)*(it.price||0); });
        y+=4; pdf.text(`Total: ${tot.toFixed(2)} ${cs.currencyCode || ''}`, 15, y);
        const dataUrl = pdf.output('datauristring');
        // This called a simulated send, so `autoSend` generated the invoice
        // and emailed nobody. The failure below is reported rather than
        // swallowed: an invoice the customer never received looks identical to
        // one they did, and the difference only surfaces when they do not pay.
        await EmailStore.send({
          to: [{ name: t.customer.name, email: t.customer.email }],
          subject,
          body,
          module: 'accounting',
          attachments: [{
            filename: `${inv.number}.pdf`,
            contentBase64: dataUrl.split(',')[1],
            contentType: 'application/pdf',
          }],
        });
        toast({ title: 'Invoice sent', description: `${inv.number} was emailed to ${t.customer.email}.` });
      }
    } catch (err) {
      toast({
        title: 'Invoice created but not emailed',
        description: `${inv.number} was generated and the schedule advanced. ${
          err instanceof Error ? err.message : 'The mail server refused it.'
        }`,
        variant: 'destructive',
      });
    }
    void recurringCache.refresh();
  };

  const columns: Column<RecurringTemplate>[] = [
    { id: "name", header: "Name", sortValue: (t) => t.name, cell: (t) => <span className="font-medium">{t.name}</span> },
    { id: "customer", header: "Customer", sortValue: (t) => t.customer.name, cell: (t) => t.customer.name },
    {
      id: "cadence",
      header: "Cadence",
      hideOnMobile: true,
      sortValue: (t) => t.cadence,
      cell: (t) => (
        <span className="capitalize text-muted-foreground">
          {t.cadence}{t.cadence === "customDays" ? ` (${t.intervalDays}d)` : ""}
        </span>
      ),
    },
    {
      id: "next",
      header: "Next run",
      sortValue: (t) => t.nextRunAt ?? "",
      cell: (t) => (t.nextRunAt ? new Date(t.nextRunAt).toLocaleString() : <span className="text-subtle">—</span>),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (t) => (t.active ? "active" : "paused"),
      cell: (t) => (
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium ${t.active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
          {t.active ? "Active" : "Paused"}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: total,
      cell: (t) => <span className="font-medium">{cs.currencySymbol}{total(t).toFixed(2)}</span>,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (t) => (
        <div className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => {
              void RecurringStore.upsert({ ...t, active: !t.active }).catch((err: unknown) =>
                toast({
                  title: "Could not change the template",
                  description: err instanceof Error ? err.message : "It is unchanged.",
                  variant: "destructive",
                }),
              );
            }}
          >
            {t.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className="sr-only">{t.active ? "Pause" : "Resume"}</span>
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => runNow(t)}>Run now</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(t); setOpen(true); }} aria-label={`Edit ${t.name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-danger"
            aria-label={`Delete ${t.name}`}
            onClick={() => {
              if (!window.confirm(`Delete recurring template "${t.name}"? This cannot be undone.`)) return;
              void RecurringStore.remove(t.id).catch((err: unknown) =>
                toast({
                  title: "Could not delete template",
                  description: err instanceof Error ? err.message : "The template is unchanged.",
                  variant: "destructive",
                }),
              );
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const activeCount = list.filter((t) => t.active).length;
  const monthlyValue = list.filter((t) => t.active).reduce((sum, t) => sum + total(t), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Recurring invoices"
        description="Templates that raise invoices automatically on a schedule."
        breadcrumbs={[{ label: "Accounting", to: "/accounting/quotations" }, { label: "Recurring" }]}
        actions={<Button onClick={() => { setEditing(undefined); setOpen(true); }}>New template</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Templates" value={list.length} hint="All time" icon={Repeat} />
          <StatCard label="Active" value={activeCount} hint={activeCount ? "Currently scheduled" : "None running"} icon={Play} tone={activeCount ? "success" : "neutral"} />
          <StatCard label="Per cycle" value={`${cs.currencySymbol}${monthlyValue.toFixed(2)}`} hint="Value of active templates" />
        </div>
      </PageHeader>

      <DataTable
        rows={list}
        columns={columns}
        rowKey={(t) => t.id}
        searchAccessor={(t) => `${t.name} ${t.customer.name} ${t.cadence}`}
        searchPlaceholder="Search templates…"
        onRowClick={(t) => { setEditing(t); setOpen(true); }}
        empty={{
          title: "No recurring templates",
          description: "Set one up and invoices will be raised — and optionally emailed — on schedule.",
          action: <Button onClick={() => { setEditing(undefined); setOpen(true); }}>New template</Button>,
        }}
      />

      <NewRecurringDialog open={open} onOpenChange={(v)=> { setOpen(v); if (!v) { setEditing(undefined); void recurringCache.refresh(); } }} onSaved={()=> void recurringCache.refresh()} editing={editing} />
    </div>
  );
};

export default Recurring;
