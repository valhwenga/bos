import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountingStore, Invoice, Quotation } from "@/lib/accountingStore";
import { Payment, PaymentMethod, PaymentStore } from "@/lib/paymentStore";
import { CompanySettingsStore } from "@/lib/companySettings";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";

export type CaptureContext = { invoice?: Invoice; quote?: Quotation };

const methods: PaymentMethod[] = ["Cash", "EFT/Bank Transfer", "Card", "Other"];

export const computeInvoiceTotals = (inv: Invoice, currencySymbol: string) => {
  const subtotal = inv.items.reduce((s, i) => s + i.qty * i.price, 0);
  // simple placeholder tax if needed in future
  const tax = 0;
  const grand = subtotal + tax;
  return { subtotal, tax, grand, currencySymbol };
};

const CapturePaymentDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  context?: CaptureContext;
  onSaved?: () => void;
}> = ({ open, onOpenChange, context, onSaved }) => {
  const c = CompanySettingsStore.get();
  const [method, setMethod] = useState<PaymentMethod>("EFT/Bank Transfer");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [amount, setAmount] = useState<number>(0);
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const customers = useMemo(() => AccountingStore.listQuotes().map(q=> q.customer)
    .concat(AccountingStore.listInvoices().map(i=> i.customer))
    .reduce((acc, cur) => acc.find(x => x.id === cur.id) ? acc : acc.concat(cur), [] as { id: string; name: string; email?: string }[]), []);

  const [customerId, setCustomerId] = useState<string>(context?.invoice?.customer.id || context?.quote?.customer.id || customers[0]?.id || "");

  const invoices = useMemo(() => AccountingStore.listInvoices().filter(i=> i.customer.id===customerId), [customerId]);
  const quotes = useMemo(() => AccountingStore.listQuotes().filter(q=> q.customer.id===customerId), [customerId]);

  const [targetType, setTargetType] = useState<"invoice" | "quote" | "unapplied">(context?.invoice ? "invoice" : (context?.quote ? "quote" : "unapplied"));
  const [targetId, setTargetId] = useState<string>(context?.invoice?.id || context?.quote?.id || invoices[0]?.id || quotes[0]?.id || "");

  const outstanding = useMemo(() => {
    if (targetType === "invoice") {
      const inv = invoices.find(i=> i.id===targetId);
      if (!inv) return 0;
      const totals = computeInvoiceTotals(inv, c.currencySymbol);
      const paid = PaymentStore.sumAmount(PaymentStore.byInvoice(inv.id));
      return Math.max(0, totals.grand - paid);
    } else if (targetType === "quote") {
      const qt = quotes.find(q=> q.id===targetId);
      if (!qt) return 0;
      const sub = qt.items.reduce((s,i)=> s + i.qty * i.price, 0);
      const discount = qt.discountPct ? (sub * qt.discountPct)/100 : 0;
      const shipping = qt.shipping || 0;
      const taxable = Math.max(0, sub - discount + shipping);
      const taxRate = (c.taxRatePct || 0) / 100;
      const tax = taxable * taxRate;
      const grand = taxable + tax;
      const paid = PaymentStore.sumAmount(PaymentStore.byQuote(qt.id));
      return Math.max(0, grand - paid);
    }
    return 0; // unapplied doesn't target a document
  }, [targetType, targetId, invoices, quotes, c.taxRatePct, c.currencySymbol]);

  const save = () => {
    if (!customerId || amount <= 0) return;
    
    let paymentType: "full" | "partial" | "overpayment";
    let updatedInvoiceStatus: Invoice["status"] | null = null;
    
    // Determine payment type and update invoice status if applicable
    if (targetType === "invoice") {
      const inv = invoices.find(i=> i.id===targetId);
      if (inv) {
        const totals = computeInvoiceTotals(inv, c.currencySymbol);
        const previouslyPaid = PaymentStore.sumAmount(PaymentStore.byInvoice(inv.id));
        const totalAfterPayment = previouslyPaid + amount;
        
        if (totalAfterPayment >= totals.grand) {
          paymentType = totalAfterPayment === totals.grand ? "full" : "overpayment";
          updatedInvoiceStatus = "paid";
        } else {
          paymentType = "partial";
        }
      }
    } else if (targetType === "quote") {
      const qt = quotes.find(q=> q.id===targetId);
      if (qt) {
        const sub = qt.items.reduce((s,i)=> s + i.qty * i.price, 0);
        const discount = qt.discountPct ? (sub * qt.discountPct)/100 : 0;
        const shipping = qt.shipping || 0;
        const taxable = Math.max(0, sub - discount + shipping);
        const taxRate = (c.taxRatePct || 0) / 100;
        const tax = taxable * taxRate;
        const grand = taxable + tax;
        const previouslyPaid = PaymentStore.sumAmount(PaymentStore.byQuote(qt.id));
        const totalAfterPayment = previouslyPaid + amount;
        
        if (totalAfterPayment >= grand) {
          paymentType = totalAfterPayment === grand ? "full" : "overpayment";
        } else {
          paymentType = "partial";
        }
      }
    } else {
      paymentType = "partial"; // Default for unapplied payments
    }
    
    const p: Payment = {
      id: `pay_${Date.now()}`,
      customerId,
      invoiceId: targetType === "invoice" ? targetId : undefined,
      quoteId: targetType === "quote" ? targetId : undefined,
      amount,
      currencyCode: c.currencyCode,
      date,
      method,
      reference,
      notes,
      paymentType, // Add payment type to payment record
    };
    
    // Add payment
    PaymentStore.add(p);
    
    // Update invoice status if it's a full payment
    if (updatedInvoiceStatus && targetType === "invoice") {
      const inv = invoices.find(i=> i.id===targetId);
      if (inv) {
        AccountingStore.upsertInvoice({ ...inv, status: updatedInvoiceStatus });
        
        // Show success notification with payment type
        const message = paymentType === "full" 
          ? "Full payment received! Invoice marked as paid."
          : paymentType === "overpayment"
          ? "Overpayment received! Invoice marked as paid."
          : "Partial payment recorded.";
        
        toast({
          title: "Payment Captured",
          description: message,
          variant: paymentType === "full" ? "default" : "destructive"
        });
      }
    } else {
      // Show notification for quote or partial payments
      toast({
        title: "Payment Captured",
        description: `${paymentType === "full" ? "Full" : paymentType === "overpayment" ? "Overpayment" : "Partial"} payment recorded successfully.`,
        variant: "default"
      });
    }
    
    onOpenChange(false);
    onSaved?.();
  };

  // Calculate payment type indicator for current amount
  const getPaymentTypeIndicator = () => {
    if (targetType !== "invoice" || !targetId) return null;
    const inv = invoices.find(i=> i.id===targetId);
    if (!inv) return null;
    
    const totals = computeInvoiceTotals(inv, c.currencySymbol);
    const previouslyPaid = PaymentStore.sumAmount(PaymentStore.byInvoice(inv.id));
    const totalAfterPayment = previouslyPaid + amount;
    
    if (totalAfterPayment >= totals.grand) {
      return totalAfterPayment === totals.grand ? "full" : "overpayment";
    } else {
      return "partial";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Capture Payment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Customer</label>
            <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setTargetId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map(cu=> <SelectItem key={cu.id} value={cu.id}>{cu.name}{cu.email ? ` • ${cu.email}`: ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Apply To</label>
              <Select value={targetType} onValueChange={(v) => { const next = v as typeof targetType; setTargetType(next); if (next === 'unapplied') setTargetId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="quote">Quote (Deposit)</SelectItem>
                  <SelectItem value="unapplied">Unapplied (Customer)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetType !== 'unapplied' && (
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Document</label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {targetType === "invoice" ? (
                      invoices.map(i=> <SelectItem key={i.id} value={i.id}>{i.number}</SelectItem>)
                    ) : (
                      quotes.map(q=> <SelectItem key={q.id} value={q.id}>{q.number}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Amount ({c.currencySymbol})</label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(parseFloat(e.target.value || "0"))} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Method</label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {methods.map(m=> <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Reference</label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank ref" />
            </div>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground">Outstanding: <span className="font-medium text-foreground">{c.currencySymbol}{outstanding.toFixed(2)}</span>{targetType==='unapplied' && <span className="ml-1 text-muted-foreground">(N/A for unapplied)</span>}</div>
          {getPaymentTypeIndicator() && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Payment Type:</span>
              <Badge variant={
                getPaymentTypeIndicator() === "full" ? "default" : 
                getPaymentTypeIndicator() === "overpayment" ? "destructive" : 
                "secondary"
              }>
                {getPaymentTypeIndicator() === "full" ? "Full Payment" : 
                 getPaymentTypeIndicator() === "overpayment" ? "Overpayment" : 
                 "Partial Payment"}
              </Badge>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!customerId || amount <= 0 || (targetType === 'unapplied' && !targetId)}>Save Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CapturePaymentDialog;
