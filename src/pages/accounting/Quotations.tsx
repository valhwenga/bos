import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { AccountingStore, Quotation, LineItem } from "@/lib/accountingStore";
import { toast } from "@/components/ui/use-toast";
import { CompanySettingsStore } from "@/lib/companySettings";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
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

const NewQuoteDialog: React.FC<{ open: boolean; onOpenChange: (v:boolean)=>void; onAdd: (q: Quotation) => void }>= ({ open, onOpenChange, onAdd }) => {
  const customers = CustomersStore.list();
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || "");
  const [estimateNo] = useState(`Q-${new Date().getFullYear()}-${Math.floor(Math.random()*9000+1000)}`);
  const [estimateDate] = useState(new Date().toISOString().slice(0,10));
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
    id: `q_${Date.now()}`,
    number: estimateNo,
    customer: selectedCustomer || { id: customerId || `c_${Date.now()}`, name: selectedCustomer?.name || "" },
    items,
    status: "draft",
    createdAt: new Date().toISOString(),
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
    onAdd(quote);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Quotation</DialogTitle>
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
            {CompanySettingsStore.get().taxRatePct ? (
              <div className="flex items-center justify-between text-sm mt-2"><span>Tax ({CompanySettingsStore.get().taxRatePct}%)</span><span>{t.tax.toFixed(2)}</span></div>
            ) : null}
            <div className="h-px bg-border my-2" />
            <div className="flex items-center justify-between font-semibold mt-1"><span>Grand Total</span><span>{t.grand.toFixed(2)}</span></div>
            <div className="flex items-center justify-between text-sm mt-1"><span>Balance Due</span><span className="font-semibold">{t.grand.toFixed(2)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=> onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save as Draft</Button>
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

  useEffect(() => {
    const refresh = () => setQuotes(AccountingStore.listQuotes());
    const onPayments = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("acct.payments") || e.key.startsWith("acct.quotes")) refresh();
    };
    window.addEventListener('payments-changed', onPayments as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('payments-changed', onPayments as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const addQuote = (q: Quotation) => {
    AccountingStore.upsertQuote(q);
    setQuotes(AccountingStore.listQuotes());
    toast({ title: "Quotation added", description: q.number });
  };

  const convert = (id: string) => {
    const inv = AccountingStore.convertQuoteToInvoice(id);
    if (inv) toast({ title: "Converted to invoice", description: inv.number });
  };

  const emailQuote = (q: Quotation) => {
    const total = computeTotals(q).grand.toFixed(2);
    const subject = encodeURIComponent(`Quotation ${q.number}`);
    const body = encodeURIComponent(
      `Hello ${q.customer.name},%0D%0A%0D%0APlease find quotation ${q.number}.%0D%0ATotal: $${total}.%0D%0A%0D%0AThank you.`,
    );
    window.location.href = `mailto:${q.customer.email || ""}?subject=${subject}&body=${body}`;
  };

  const printQuote = (q: Quotation) => navigate(`/accounting/quotations/${q.id}/print`);

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Quotations</CardTitle>
          <Button onClick={()=> setOpen(true)}>New Quotation</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>{q.number}</TableCell>
                    <TableCell>{q.customer.name}</TableCell>
                    <TableCell className="capitalize">{q.status}</TableCell>
                    <TableCell className="text-right">{c.currencySymbol}{PaymentStore.sumAmount(PaymentStore.byQuote(q.id)).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{c.currencySymbol}{outstanding(q).toFixed(2)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="secondary" onClick={()=> { setActiveQuote(q); setCapOpen(true); }}>Capture Payment</Button>
                      <Button size="sm" variant="secondary" onClick={() => emailQuote(q)}>Email</Button>
                      <Button size="sm" variant="outline" onClick={() => printQuote(q)}>Print/PDF</Button>
                      <Button size="sm" onClick={() => convert(q.id)}>Convert to Invoice</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <NewQuoteDialog open={open} onOpenChange={setOpen} onAdd={addQuote} />
      <CapturePaymentDialog open={capOpen} onOpenChange={(v)=> { setCapOpen(v); if (!v) { setActiveQuote(undefined); setQuotes(AccountingStore.listQuotes()); } }} context={{ quote: activeQuote }} onSaved={()=> { setQuotes(AccountingStore.listQuotes()); }} />
    </div>
  );
};

export default Quotations;
