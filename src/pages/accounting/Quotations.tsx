import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { AccountingStore, Quotation, LineItem } from "@/lib/accountingStore";
import { previewNextNumber, resolveNumberOnSave } from "@/lib/documentNumbers";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { toast } from "@/components/ui/use-toast";
import { CompanySettingsStore } from "@/lib/companySettings";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, CreditCard, Eye, Printer, ArrowRightLeft, Edit, Trash2, FileText, TrendingUp, CheckCircle2 } from "lucide-react";
import { CustomersStore } from "@/lib/customersStore";
import { ProductsStore } from "@/lib/productsStore";
import { useNavigate } from "react-router-dom";
import { PaymentStore } from "@/lib/paymentStore";
import CapturePaymentDialog from "@/components/accounting/CapturePaymentDialog";

const computeTotals = (q: Quotation) => {
  const sub = q.items.reduce((s, i) => s + i.qty * i.price, 0);
  const discount = q.discountPct ? (sub * q.discountPct) / 100 : 0;
  const shipping = q.shipping || 0;
  const c = CompanySettingsStore.get();
  const taxable = Math.max(0, sub - discount + shipping);
  const taxRate = (c.taxRatePct || 0) / 100;
  const tax = taxable * taxRate;
  const grand = taxable + tax;
  return { sub, discount, shipping, tax, grand };
};

const NewQuoteDialog: React.FC<{ open: boolean; onOpenChange: (v:boolean)=>void; onAdd: (q: Quotation) => void; editing?: Quotation }>= ({ open, onOpenChange, onAdd, editing }) => {
  const customers = CustomersStore.list();
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || "");
  const [estimateNo, setEstimateNo] = useState(() => previewNextNumber("quotation"));
  const [estimateDate, setEstimateDate] = useState(new Date().toISOString().slice(0,10));
  const [expiryDate, setExpiryDate] = useState("");
  const [reference, setReference] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [projectName, setProjectName] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [shipping, setShipping] = useState<number>(0);
  const [useShippingAddress, setUseShippingAddress] = useState<boolean>(false);
  const products = ProductsStore.list();
  const [items, setItems] = useState<LineItem[]>([{ id: `li_${Date.now()}`, name: products[0]?.name || "Item", qty: 1, price: products[0]?.price || 0, description: products[0]?.description || "" }]);
  const [custOpen, setCustOpen] = useState(false);

  // Populate from the record being edited, or reset for a new quotation.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCustomerId(editing.customer?.id || customers[0]?.id || "");
      setEstimateNo(editing.number);
      setEstimateDate(editing.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setExpiryDate(editing.expiryDate || "");
      setReference(editing.reference || "");
      setSalesperson(editing.salesperson || "");
      setProjectName(editing.projectName || "");
      setSubject(editing.subject || "");
      setNotes(editing.notes || "");
      setDiscountPct(editing.discountPct || 0);
      setShipping(editing.shipping || 0);
      setUseShippingAddress(!!editing.useShippingAddress);
      setItems(editing.items?.length ? editing.items.map((i) => ({ ...i })) : []);
    } else {
      setCustomerId(customers[0]?.id || "");
      setEstimateNo(previewNextNumber("quotation"));
      setEstimateDate(new Date().toISOString().slice(0, 10));
      setExpiryDate("");
      setReference("");
      setSalesperson("");
      setProjectName("");
      setSubject("");
      setNotes("");
      setDiscountPct(0);
      setShipping(0);
      setUseShippingAddress(false);
      setItems([{ id: `li_${Date.now()}`, name: products[0]?.name || "Item", qty: 1, price: products[0]?.price || 0, description: products[0]?.description || "" }]);
    }
    // Re-seeding on every `customers`/`products` identity change would clobber
    // edits mid-session; the open/editing pair is what should drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const addItem = () => setItems(prev => [...prev, { id: `li_${Date.now()}`, name: products[0]?.name || "Item", qty: 1, price: products[0]?.price || 0, description: products[0]?.description || "" }]);
  const removeItem = (id: string) => setItems(prev => prev.filter(i=> i.id!==id));
  const updateItem = (id: string, patch: Partial<LineItem>) => setItems(prev => prev.map(i=> i.id===id ? { ...i, ...patch } : i));
  const selectProduct = (id: string, productId: string) => {
    const p = products.find(x=> x.id===productId);
    if (!p) return;
    updateItem(id, { name: p.name, price: p.price, description: p.description });
  };

  const selectedCustomer = customers.find(c=> c.id===customerId) || customers[0];
  const quote: Quotation = {
    // Keep the existing identity, number, status and creation date when
    // editing; a fresh id here would save a duplicate instead of an update.
    id: editing?.id || `q_${Date.now()}`,
    number: estimateNo,
    customer: selectedCustomer || { id: customerId || `c_${Date.now()}`, name: selectedCustomer?.name || "" },
    items,
    status: editing?.status || "draft",
    createdAt: editing?.createdAt || new Date().toISOString(),
    notes,
    reference,
    expiryDate,
    subject,
    salesperson,
    projectName,
    discountPct,
    shipping,
    useShippingAddress,
  };
  const t = computeTotals(quote);

  const save = () => {
    if (!customerId) { toast({ title: "Customer required", variant: "destructive" }); return; }
    if (items.length===0 || items.some(i=> !i.name.trim())) { toast({ title: "Add at least one item", variant: "destructive" }); return; }
    // Editing keeps the existing number; a new quotation consumes one now.
    const number = editing
      ? quote.number
      : resolveNumberOnSave("quotation", estimateNo, previewNextNumber("quotation"));
    onAdd({ ...quote, number });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.number}` : "New Quotation"}</DialogTitle>
        </DialogHeader>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Customer</label>
            <Popover open={custOpen} onOpenChange={setCustOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none">
                  <span className="truncate text-left">
                    {customers.find(c=> c.id===customerId)?.name || "Select a customer"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search customer..." />
                  <CommandEmpty>No customer found.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      {customers.map(c => (
                        <CommandItem key={c.id} value={`${c.name} ${c.email||''}`.trim()} onSelect={() => { setCustomerId(c.id); setCustOpen(false); }}>
                          <Check className={`mr-2 h-4 w-4 ${customerId===c.id ? 'opacity-100' : 'opacity-0'}`} />
                          <span className="truncate">{c.name}{c.email ? ` • ${c.email}`: ''}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Estimate#</label>
            <Input value={estimateNo} disabled />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Estimate Date</label>
            <Input type="date" value={estimateDate} disabled />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Expiry Date</label>
            <Input type="date" value={expiryDate} onChange={(e)=> setExpiryDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Reference#</label>
            <Input value={reference} onChange={(e)=> setReference(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Salesperson</label>
            <Input value={salesperson} onChange={(e)=> setSalesperson(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Project name</label>
            <Input value={projectName} onChange={(e)=> setProjectName(e.target.value)} />
          </div>
          <div className="grid gap-2 lg:col-span-2">
            <label className="text-xs text-muted-foreground">Subject</label>
            <Input value={subject} onChange={(e)=> setSubject(e.target.value)} placeholder="Let your customer know what this Estimate is for" />
          </div>
        </div>

        <div className="mt-4 border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(i => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Select value={products.find(p=> p.name===i.name)?.id || ""} onValueChange={(pid)=> selectProduct(i.id, pid)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an item" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p=> <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input value={i.description || ""} onChange={(e)=> updateItem(i.id, { description: e.target.value })} placeholder="Description" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input className="text-right" type="number" min={0} value={i.qty} onChange={(e)=> updateItem(i.id, { qty: parseFloat(e.target.value||"0") })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input className="text-right" type="number" min={0} value={i.price} onChange={(e)=> updateItem(i.id, { price: parseFloat(e.target.value||"0") })} />
                  </TableCell>
                  <TableCell className="text-right">{(i.qty * i.price).toFixed(2)}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={()=> removeItem(i.id)}>✕</Button></TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={6}>
                  <Button variant="outline" size="sm" onClick={addItem}>Add New Line Item</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2">
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Customer notes</label>
              <Input value={notes} onChange={(e)=> setNotes(e.target.value)} placeholder="Notes to appear on quote" />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input id="use-ship" type="checkbox" checked={useShippingAddress} onChange={(e)=> setUseShippingAddress(e.target.checked)} />
              <label htmlFor="use-ship" className="text-sm">Use Shipping Address on Quote (Bill To)</label>
            </div>
          </div>
          <div className="border rounded-lg p-3 bg-card">
            <div className="flex items-center justify-between text-sm"><span>Sub Total</span><span>{t.sub.toFixed(2)}</span></div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span>Discount</span>
              <div className="flex items-center gap-2">
                <Input className="w-20 text-right" type="number" min={0} max={100} value={discountPct} onChange={(e)=> setDiscountPct(parseFloat(e.target.value||"0"))} />
                <span>%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span>Shipping</span>
              <Input className="w-24 text-right" type="number" min={0} value={shipping} onChange={(e)=> setShipping(parseFloat(e.target.value||"0"))} />
            </div>
            {CompanySettingsStore.get()?.taxRatePct ? (
              <div className="flex items-center justify-between text-sm mt-2"><span>Tax ({CompanySettingsStore.get()?.taxRatePct}%)</span><span>{t.tax.toFixed(2)}</span></div>
            ) : null}
            <div className="h-px bg-border my-2" />
            <div className="flex items-center justify-between font-semibold mt-1"><span>Grand Total</span><span>{t.grand.toFixed(2)}</span></div>
            <div className="flex items-center justify-between text-sm mt-1"><span>Balance Due</span><span className="font-semibold">{t.grand.toFixed(2)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=> onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Save changes" : "Save as draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Quotations: React.FC = () => {
  const [quotes, setQuotes] = useState(AccountingStore.listQuotes());
  const navigate = useNavigate();
  const total = useMemo(() => (q: Quotation) => computeTotals(q).grand, []);
  const c = CompanySettingsStore.get();
  const outstanding = (q: Quotation) => {
    const grand = computeTotals(q).grand;
    const paid = PaymentStore.sumAmount(PaymentStore.byQuote(q.id));
    return Math.max(0, grand - paid);
  };
  const [capOpen, setCapOpen] = useState(false);
  const [activeQuote, setActiveQuote] = useState<Quotation | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | undefined>(undefined);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<Quotation | undefined>(undefined);

  useEffect(() => {
    const refresh = () => setQuotes(AccountingStore.listQuotes());
    const onPayments = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("acct.payments") || e.key.startsWith("acct.quotes")) refresh();
    };
    window.addEventListener('payments-changed', onPayments as EventListener);
    window.addEventListener('storage', onStorage);
    
    return () => {
      window.removeEventListener('payments-changed', onPayments as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const editQuote = (q: Quotation) => {
    setEditing(q);
    setOpen(true);
  };

  const saveQuote = (q: Quotation) => {
    const isEdit = !!editing;
    AccountingStore.upsertQuote(q);
    setQuotes(AccountingStore.listQuotes());
    setEditing(undefined);
    toast({ title: isEdit ? "Quotation updated" : "Quotation added", description: q.number });
  };

  const convert = (id: string) => {
    const inv = AccountingStore.convertQuoteToInvoice(id);
    if (inv) toast({ title: "Converted to invoice", description: inv.number });
  };

  const emailQuote = (q: Quotation) => {
    const total = computeTotals(q).grand.toFixed(2);
    const subject = encodeURIComponent(`Quotation ${q.number}`);
    const sym = c.currencySymbol || "$";
    const body = encodeURIComponent(
      `Hello ${q.customer.name},%0D%0A%0D%0APlease find quotation ${q.number}.%0D%0ATotal: ${sym}${total}.%0D%0A%0D%0AThank you.`,
    );
    window.location.href = `mailto:${q.customer.email || ""}?subject=${subject}&body=${body}`;
  };

  const printQuote = (q: Quotation) => navigate(`/accounting/quotations/${q.id}/print`);

  const quotePrintUrl = (id: string) => `${import.meta.env.BASE_URL}accounting/quotations/${id}/print`;

  const openPreview = (q: Quotation) => {
    setPreviewQuote(q);
    setPreviewOpen(true);
  };

  const statusTone: Record<Quotation["status"], string> = {
    accepted: "bg-success-soft text-success",
    converted: "bg-info-soft text-info",
    declined: "bg-danger-soft text-danger",
    sent: "bg-warning-soft text-warning",
    draft: "bg-muted text-muted-foreground",
  };

  const paidFor = (q: Quotation) => PaymentStore.sumAmount(PaymentStore.byQuote(q.id));

  const columns: Column<Quotation>[] = [
    { id: "number", header: "No.", sortValue: (q) => q.number, cell: (q) => <span className="font-medium">{q.number}</span> },
    { id: "customer", header: "Customer", sortValue: (q) => q.customer.name, cell: (q) => q.customer.name },
    {
      id: "status",
      header: "Status",
      sortValue: (q) => q.status,
      cell: (q) => (
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${statusTone[q.status]}`}>
          {q.status}
        </span>
      ),
    },
    { id: "paid", header: "Paid", align: "right", hideOnMobile: true, sortValue: paidFor, cell: (q) => `${c.currencySymbol}${paidFor(q).toFixed(2)}` },
    {
      id: "balance",
      header: "Balance",
      align: "right",
      sortValue: outstanding,
      cell: (q) => (
        <span className={outstanding(q) > 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
          {c.currencySymbol}{outstanding(q).toFixed(2)}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (q) => (
        <div className="inline-flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => editQuote(q)} aria-label={`Edit ${q.number}`}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => printQuote(q)} aria-label={`Print ${q.number}`}>
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setActiveQuote(q); setCapOpen(true); }} aria-label={`Capture payment for ${q.number}`}>
            <CreditCard className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => convert(q.id)} aria-label={`Convert ${q.number} to invoice`} title="Convert to invoice">
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-danger"
            aria-label={`Delete ${q.number}`}
            onClick={() => {
              if (confirm(`Delete quotation ${q.number}? This cannot be undone.`)) {
                AccountingStore.removeQuote(q.id);
                setQuotes(AccountingStore.listQuotes());
                toast({ title: "Quotation deleted", description: q.number });
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const pipeline = quotes
    .filter((q) => q.status !== "declined" && q.status !== "converted")
    .reduce((sum, q) => sum + q.items.reduce((t, i) => t + i.qty * i.price, 0), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Quotations"
        description="Quotes you've sent, and what they're worth if they land."
        breadcrumbs={[{ label: "Accounting", to: "/accounting/quotations" }, { label: "Quotations" }]}
        actions={<Button onClick={() => { setEditing(undefined); setOpen(true); }}>New quotation</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Quotations" value={quotes.length} hint="All time" icon={FileText} />
          <StatCard
            label="Open pipeline"
            value={`${c.currencySymbol}${pipeline.toFixed(2)}`}
            hint="Excludes declined and converted"
            icon={TrendingUp}
            tone="info"
          />
          <StatCard
            label="Accepted"
            value={quotes.filter((q) => q.status === "accepted").length}
            hint="Ready to invoice"
            icon={CheckCircle2}
            tone="success"
          />
        </div>
      </PageHeader>

      <DataTable
        rows={quotes}
        columns={columns}
        rowKey={(q) => q.id}
        searchAccessor={(q) => `${q.number} ${q.customer.name} ${q.status}`}
        searchPlaceholder="Search by number, customer or status…"
        onRowClick={(q) => openPreview(q)}
        empty={{
          title: "No quotations yet",
          description: "Send your first quote — accepted ones convert straight into invoices.",
          action: <Button onClick={() => { setEditing(undefined); setOpen(true); }}>New quotation</Button>,
        }}
      />

      <NewQuoteDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(undefined); }}
        onAdd={saveQuote}
        editing={editing}
      />
      <CapturePaymentDialog open={capOpen} onOpenChange={(v)=> { setCapOpen(v); if (!v) { setActiveQuote(undefined); setQuotes(AccountingStore.listQuotes()); } }} context={{ quote: activeQuote }} onSaved={()=> { setQuotes(AccountingStore.listQuotes()); }} />

      <Dialog open={previewOpen} onOpenChange={(v) => { setPreviewOpen(v); if (!v) setPreviewQuote(undefined); }}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Quotation Preview</DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] border rounded overflow-hidden bg-white">
            {previewQuote ? (
              <iframe
                title="Quotation preview"
                className="w-full h-full"
                src={quotePrintUrl(previewQuote.id)}
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>Close</Button>
            {previewQuote ? (
              <>
                <Button variant="outline" onClick={() => printQuote(previewQuote)}>Open Full Preview</Button>
                <Button onClick={() => { emailQuote(previewQuote); setPreviewOpen(false); }}>Send Email</Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Quotations;
