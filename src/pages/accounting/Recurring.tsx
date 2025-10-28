import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RecurringStore, type RecurringTemplate, type RecurringCadence } from "@/lib/recurringStore";
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
    let t = base;
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

  const save = () => {
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
    RecurringStore.upsert(tpl);
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
          <Button onClick={save} disabled={!name.trim() || !customerId || items.length===0}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Recurring: React.FC = () => {
  const cs = CompanySettingsStore.get();
  const [list, setList] = useState(RecurringStore.list());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTemplate | undefined>(undefined);

  useEffect(() => {
    const refresh = () => setList(RecurringStore.list());
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
    AccountingStore.upsertInvoice(inv as any);
    RecurringStore.upsert({ ...t, lastRunAt: new Date().toISOString(), nextRunAt: RecurringStore.computeNextRun(t), nextNumber: (t.nextNumber || 1) + 1 });
    try {
      if (t.autoSend && t.customer.email) {
        const subject = `Invoice ${inv.number} from ${cs.name || 'Our Company'}`;
        const body = `Dear ${t.customer.name},\n\nPlease find attached your invoice ${inv.number}.\n\nRegards,\n${cs.name || 'Our Company'}`;
        const ensureScript = (src: string) => new Promise<void>((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load '+src)); document.head.appendChild(s); });
        const w: any = window as any;
        if (!(w.jspdf || w.jspdf_esm || w.jspdfjs)) { try { await ensureScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'); } catch {} }
        const { jsPDF } = (w.jspdf || w.jspdf_esm || w.jspdfjs) as any;
        const pdf = new jsPDF('p','mm','a4');
        let y = 15; pdf.setFontSize(16); pdf.text(`Invoice ${inv.number}`, 15, y); y+=8;
        pdf.setFontSize(11); pdf.text(`Date: ${new Date(inv.createdAt).toLocaleDateString()}`, 15, y); y+=6;
        pdf.text(`Bill To: ${t.customer.name}`, 15, y); y+=8;
        pdf.setFontSize(12); pdf.text('Items', 15, y); y+=6; pdf.setFontSize(11);
        let tot = 0; t.items.forEach((it:any)=> { pdf.text(`${it.name}  ${it.qty} x ${it.price.toFixed(2)}`, 20, y); y+=6; tot += (it.qty||0)*(it.price||0); });
        y+=4; pdf.text(`Total: ${tot.toFixed(2)} ${cs.currencyCode || ''}`, 15, y);
        const dataUrl = pdf.output('datauristring');
        await EmailStore.send({ from: { name: cs.name || 'Billing', email: cs.email || 'noreply@example.com' }, to: [{ name: t.customer.name, email: t.customer.email }], subject, body, attachments: [{ id: `att_${Date.now()}`, name: `${inv.number}.pdf`, type: 'application/pdf', size: dataUrl.length, dataUrl }] } as any);
      }
    } catch {}
    setList(RecurringStore.list());
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recurring Invoices</CardTitle>
          <Button onClick={()=> { setEditing(undefined); setOpen(true); }}>New Template</Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.customer.name}</TableCell>
                    <TableCell className="capitalize">{t.cadence}{t.cadence==='customDays' ? ` (${t.intervalDays}d)` : ''}</TableCell>
                    <TableCell>{t.nextRunAt ? new Date(t.nextRunAt).toLocaleString() : '-'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant={t.active ? 'secondary' : 'outline'} onClick={()=> { RecurringStore.upsert({ ...t, active: !t.active }); setList(RecurringStore.list()); }}>
                        {t.active ? 'Pause' : 'Resume'}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">{cs.currencySymbol}{total(t).toFixed(2)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={()=> { setEditing(t); setOpen(true); }}>Edit</Button>
                      <Button size="sm" onClick={()=> runNow(t)}>Run Now</Button>
                      <Button size="sm" variant="destructive" onClick={()=> { RecurringStore.remove(t.id); setList(RecurringStore.list()); }}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <NewRecurringDialog open={open} onOpenChange={(v)=> { setOpen(v); if (!v) { setEditing(undefined); setList(RecurringStore.list()); } }} onSaved={()=> setList(RecurringStore.list())} editing={editing} />
    </div>
  );
};

export default Recurring;
