import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CapturePaymentDialog from "@/components/accounting/CapturePaymentDialog";
import { Payment, PaymentMethod, PaymentStore } from "@/lib/paymentStore";
import { AccountingStore } from "@/lib/accountingStore";
import { CompanySettingsStore } from "@/lib/companySettings";

const Payments: React.FC = () => {
  const c = CompanySettingsStore.get();
  const [payments, setPayments] = useState(PaymentStore.list());
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const customers = useMemo(() => AccountingStore.listQuotes().map(q=> q.customer)
    .concat(AccountingStore.listInvoices().map(i=> i.customer))
    .reduce((acc, cur)=> acc.find(x=> x.id===cur.id) ? acc : acc.concat(cur), [] as {id:string; name:string}[]), []);
  const [customerId, setCustomerId] = useState<string>("all");
  const [type, setType] = useState<"all"|"invoice"|"quote">("all");
  const [method, setMethod] = useState<PaymentMethod|"all">("all");

  const filtered = payments.filter(p =>
    (customerId==="all" || p.customerId===customerId)
    && (type==="all" || (type==="invoice" ? !!p.invoiceId : !!p.quoteId))
    && (method==="all" || p.method===method)
    && (!q || (p.reference||"").toLowerCase().includes(q.toLowerCase()) || (p.notes||"").toLowerCase().includes(q.toLowerCase()))
  );

  const del = (id: string) => { PaymentStore.remove(id); setPayments(PaymentStore.list()); };

  useEffect(() => {
    const refresh = () => setPayments(PaymentStore.list());
    const onStorage = (e: StorageEvent) => { if (e.key && e.key.startsWith('acct.payments')) refresh(); };
    window.addEventListener('payments-changed', refresh as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('payments-changed', refresh as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Payments</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Search ref/notes" value={q} onChange={(e)=> setQ(e.target.value)} className="w-56" />
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All customers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                {customers.map(cu=> <SelectItem key={cu.id} value={cu.id}>{cu.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v:any)=> setType(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
                <SelectItem value="quote">Quotes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={method} onValueChange={(v:any)=> setMethod(v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="EFT/Bank Transfer">EFT/Bank Transfer</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={()=> setOpen(true)}>Add Payment</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Applied To</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p=> {
                  const customer = customers.find(cu=> cu.id===p.customerId);
                  const applied = p.invoiceId ? `Invoice ${p.invoiceId}` : (p.quoteId ? `Quote ${p.quoteId}` : "Unapplied");
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.date).toLocaleDateString()}</TableCell>
                      <TableCell>{customer?.name || p.customerId}</TableCell>
                      <TableCell>{applied}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{p.reference}</TableCell>
                      <TableCell className="max-w-[260px] truncate" title={p.notes}>{p.notes}</TableCell>
                      <TableCell className="text-right">{c.currencySymbol}{(p.amount||0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="destructive" onClick={()=> del(p.id)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <CapturePaymentDialog open={open} onOpenChange={(v)=> { setOpen(v); if (!v) setPayments(PaymentStore.list()); }} />
    </div>
  );
};

export default Payments;
