import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CapturePaymentDialog from "@/components/accounting/CapturePaymentDialog";
import { Trash2, Receipt, Wallet, AlertCircle } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Payment, PaymentMethod, PaymentStore } from "@/lib/paymentStore";
import { AccountingStore, Invoice, Quotation } from "@/lib/accountingStore";
import { CompanySettingsStore } from "@/lib/companySettings";
import { toast } from "@/components/ui/use-toast";

const Payments: React.FC = () => {
  const cs = CompanySettingsStore.get();
  const [payments, setPayments] = useState(PaymentStore.list());
  const [open, setOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [q, setQ] = useState("");
  const customers = useMemo(() => AccountingStore.listQuotes().map(q=> q.customer)
    .concat(AccountingStore.listInvoices().map(i=> i.customer))
    .reduce((acc, cur)=> acc.find(x=> x.id===cur.id) ? acc : acc.concat(cur), [] as {id:string; name:string}[]), []);
  const [customerId, setCustomerId] = useState<string>("all");
  const [type, setType] = useState<"all"|"invoice"|"quote">("all");
  const [method, setMethod] = useState<PaymentMethod|"all">("all");
  const [targetInvoiceId, setTargetInvoiceId] = useState<string>("");
  const [targetQuoteId, setTargetQuoteId] = useState<string>("");

  const filtered = payments.filter(p =>
    (customerId==="all" || p.customerId===customerId)
    && (type==="all" || (type==="invoice" ? !!p.invoiceId : !!p.quoteId))
    && (method==="all" || p.method===method)
    && (!q || (p.reference||"").toLowerCase().includes(q.toLowerCase()) || (p.notes||"").toLowerCase().includes(q.toLowerCase()))
  );

  const del = (id: string) => {
    const ok = window.confirm("Delete this payment? This action cannot be undone.");
    if (!ok) return;
    PaymentStore.remove(id);
    setPayments(PaymentStore.list());
  };

  const applyPayment = () => {
    if (!selectedPayment) return;
    
    let updatedPayment = { ...selectedPayment };
    
    if (targetInvoiceId) {
      updatedPayment.invoiceId = targetInvoiceId;
      updatedPayment.quoteId = undefined;
      toast({ title: "Payment Applied", description: `Payment applied to invoice ${targetInvoiceId}` });
    } else if (targetQuoteId) {
      updatedPayment.quoteId = targetQuoteId;
      updatedPayment.invoiceId = undefined;
      toast({ title: "Payment Applied", description: `Payment applied to quote ${targetQuoteId}` });
    }
    
    PaymentStore.update(updatedPayment);
    setPayments(PaymentStore.list());
    setApplyOpen(false);
    setSelectedPayment(null);
    setTargetInvoiceId("");
    setTargetQuoteId("");
  };

  const convertAcceptedQuotes = () => {
    const quotes = AccountingStore.listQuotes();
    const acceptedQuotes = quotes.filter(q => q.status === "accepted");
    
    if (acceptedQuotes.length === 0) {
      toast({ title: "No Accepted Quotes", description: "There are no accepted quotes to convert." });
      return;
    }
    
    let convertedCount = 0;
    acceptedQuotes.forEach(quote => {
      // Convert quote to invoice
      const invoice: Invoice = {
        id: `inv_${Date.now()}_${convertedCount}`,
        number: `INV-${new Date().getFullYear()}-${Math.floor(Math.random()*9000+1000)}`,
        customer: quote.customer,
        items: quote.items,
        status: "sent",
        createdAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        notes: quote.notes,
        reference: quote.reference,
        discountPct: quote.discountPct,
        shipping: quote.shipping,
        useShippingAddress: quote.useShippingAddress,
      };
      
      AccountingStore.upsertInvoice(invoice);
      
      // Update quote status to converted
      AccountingStore.upsertQuote({ ...quote, status: "converted" });
      
      // Apply any existing payments for this quote to the new invoice
      const quotePayments = PaymentStore.byQuote(quote.id);
      quotePayments.forEach(payment => {
        PaymentStore.update({
          ...payment,
          invoiceId: invoice.id,
          quoteId: undefined
        });
      });
      
      convertedCount++;
    });
    
    toast({ 
      title: "Quotes Converted", 
      description: `Successfully converted ${convertedCount} accepted quote(s) to invoices.` 
    });
    setPayments(PaymentStore.list());
  };

  useEffect(() => {
    const refresh = () => setPayments(PaymentStore.list());
    const onStorage = (e: StorageEvent) => { if (e.key && e.key.startsWith('acct.payments')) refresh(); };
    window.addEventListener('payments-changed', refresh as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('payments-changed', refresh as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const columns: Column<Payment>[] = [
    {
      id: "date",
      header: "Date",
      sortValue: (p) => p.date,
      cell: (p) => new Date(p.date).toLocaleDateString(),
    },
    {
      id: "customer",
      header: "Customer",
      sortValue: (p) => customers.find((cu) => cu.id === p.customerId)?.name ?? "",
      cell: (p) => <span className="font-medium">{customers.find((cu) => cu.id === p.customerId)?.name || p.customerId}</span>,
    },
    {
      id: "applied",
      header: "Applied to",
      hideOnMobile: true,
      cell: (p) =>
        p.invoiceId ? (
          <span className="text-info">Invoice {p.invoiceId}</span>
        ) : p.quoteId ? (
          <span className="text-muted-foreground">Quote {p.quoteId}</span>
        ) : (
          <span className="rounded-sm bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning">Unapplied</span>
        ),
    },
    { id: "method", header: "Method", hideOnMobile: true, sortValue: (p) => p.method ?? "", cell: (p) => p.method || "—" },
    { id: "reference", header: "Reference", hideOnMobile: true, cell: (p) => p.reference || <span className="text-subtle">—</span> },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (p) => p.amount ?? 0,
      cell: (p) => <span className="font-medium">{cs.currencySymbol}{(p.amount || 0).toFixed(2)}</span>,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-danger"
            onClick={() => del(p.id)}
            aria-label="Delete payment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const received = filtered.reduce((sum, p) => sum + (p.amount || 0), 0);
  const unapplied = filtered.filter((p) => !p.invoiceId && !p.quoteId).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Payments"
        description="Money received, and what each payment has been applied to."
        breadcrumbs={[{ label: "Accounting", to: "/accounting/quotations" }, { label: "Payments" }]}
        actions={
          <>
            <Button variant="outline" onClick={convertAcceptedQuotes}>Convert accepted quotes</Button>
            <Button onClick={() => setOpen(true)}>Add payment</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Payments" value={filtered.length} hint="Matching current filters" icon={Receipt} />
          <StatCard label="Received" value={`${cs.currencySymbol}${received.toFixed(2)}`} hint="Sum of shown payments" icon={Wallet} tone="success" />
          <StatCard
            label="Unapplied"
            value={unapplied}
            hint={unapplied ? "Not linked to a document" : "All allocated"}
            icon={AlertCircle}
            tone={unapplied ? "warning" : "neutral"}
          />
        </div>
      </PageHeader>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(p) => p.id}
        searchAccessor={(p) => `${p.reference ?? ""} ${p.notes ?? ""} ${p.method ?? ""} ${customers.find((cu) => cu.id === p.customerId)?.name ?? ""}`}
        searchPlaceholder="Search reference, notes or customer…"
        onRowClick={(p) => { setSelectedPayment(p); setApplyOpen(true); }}
        toolbar={
          <>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All customers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                {customers.map((cu) => <SelectItem key={cu.id} value={cu.id}>{cu.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
                <SelectItem value="quote">Quotes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="EFT/Bank Transfer">EFT/Bank Transfer</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        empty={{
          title: "No payments recorded",
          description: "Capture a payment against an invoice or quote and it will appear here.",
          action: <Button onClick={() => setOpen(true)}>Add payment</Button>,
        }}
      />

      <CapturePaymentDialog open={open} onOpenChange={(v)=> { setOpen(v); if (!v) setPayments(PaymentStore.list()); }} onSaved={()=> setPayments(PaymentStore.list())} />
      
      <Dialog open={applyOpen} onOpenChange={(v) => { setApplyOpen(v); if (!v) { setSelectedPayment(null); setTargetInvoiceId(""); setTargetQuoteId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPayment && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium">Payment Details</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Amount: {cs.currencySymbol}{selectedPayment.amount.toFixed(2)} | Method: {selectedPayment.method}
                </div>
                {selectedPayment.reference && (
                  <div className="text-xs text-muted-foreground">Reference: {selectedPayment.reference}</div>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Apply to Invoice</label>
              <Select value={targetInvoiceId} onValueChange={(value) => { setTargetInvoiceId(value); setTargetQuoteId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {AccountingStore.listInvoices()
                    .filter(inv => inv.customer.id === selectedPayment?.customerId)
                    .map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        Invoice {inv.number} - {inv.customer.name} ({cs.currencySymbol}{inv.items.reduce((sum, item) => sum + (item.qty * item.price), 0).toFixed(2)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Apply to Quote</label>
              <Select value={targetQuoteId} onValueChange={(value) => { setTargetQuoteId(value); setTargetInvoiceId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quote (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {AccountingStore.listQuotes()
                    .filter(q => q.status !== "converted" && q.customer.id === selectedPayment?.customerId)
                    .map(q => (
                      <SelectItem key={q.id} value={q.id}>
                        Quote {q.number} - {q.customer.name} ({cs.currencySymbol}{q.items.reduce((sum, item) => sum + (item.qty * item.price), 0).toFixed(2)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button onClick={applyPayment} disabled={!targetInvoiceId && !targetQuoteId}>
              Apply Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payments;
