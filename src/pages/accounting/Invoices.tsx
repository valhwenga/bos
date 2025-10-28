import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountingStore, Invoice } from "@/lib/accountingStore";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PaymentStore } from "@/lib/paymentStore";
import CapturePaymentDialog from "@/components/accounting/CapturePaymentDialog";
import { CompanySettingsStore } from "@/lib/companySettings";
import { CreditNotesStore } from "@/lib/creditNotesStore";

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState(AccountingStore.listInvoices());
  const navigate = useNavigate();
  const c = CompanySettingsStore.get();
  const total = useMemo(() => (i: Invoice) => i.items.reduce((s, it) => s + it.qty * it.price, 0), []);
  const paidAmt = (i: Invoice) => PaymentStore.sumAmount(PaymentStore.byInvoice(i.id));
  const creditsApplied = (i: Invoice) => CreditNotesStore.sumAppliedToInvoice(i.id);
  const balance = (i: Invoice) => Math.max(0, total(i) - paidAmt(i) - creditsApplied(i));
  const [capOpen, setCapOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | undefined>(undefined);

  useEffect(() => {
    const refresh = () => setInvoices(AccountingStore.listInvoices());
    const onPayments = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("acct.payments") || e.key.startsWith("acct.invoices")) refresh();
    };
    window.addEventListener('payments-changed', onPayments as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('payments-changed', onPayments as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Adjusted Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.number}</TableCell>
                    <TableCell>{i.customer.name}</TableCell>
                    <TableCell className="capitalize">{i.status}</TableCell>
                    <TableCell className="text-right">{c.currencySymbol}{paidAmt(i).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{c.currencySymbol}{balance(i).toFixed(2)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="secondary" onClick={()=> { setActiveInvoice(i); setCapOpen(true); }}>Capture Payment</Button>
                      <Button size="sm" variant="outline" onClick={()=> navigate(`/accounting/invoices/${i.id}/print`)}>Print/PDF</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <CapturePaymentDialog open={capOpen} onOpenChange={(v)=> { setCapOpen(v); if (!v) { setActiveInvoice(undefined); setInvoices(AccountingStore.listInvoices()); } }} context={{ invoice: activeInvoice }} onSaved={()=> { setInvoices(AccountingStore.listInvoices()); }} />
    </div>
  );
};

export default Invoices;
