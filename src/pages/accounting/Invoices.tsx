import React, { useEffect, useMemo, useState } from "react";
import { Eye, Printer, CreditCard, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountingStore, Invoice } from "@/lib/accountingStore";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PaymentStore } from "@/lib/paymentStore";
import CapturePaymentDialog from "@/components/accounting/CapturePaymentDialog";
import { CompanySettingsStore } from "@/lib/companySettings";
import { CreditNotesStore } from "@/lib/creditNotesStore";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CustomersStore } from "@/lib/customersStore";
import { ProductsStore } from "@/lib/productsStore";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

const NewInvoiceDialog: React.FC<{ open: boolean; onOpenChange: (v:boolean)=>void; onAdd: (inv: Invoice) => void; preselectedCustomerId?: string; editingInvoice?: Invoice }>= ({ open, onOpenChange, onAdd, preselectedCustomerId, editingInvoice }) => {
  const customers = useMemo(() => CustomersStore.list(), []);
  const [customerId, setCustomerId] = useState<string>("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [shipping, setShipping] = useState<number>(0);
  const [useShippingAddress, setUseShippingAddress] = useState<boolean>(false);
  const products = useMemo(() => ProductsStore.list(), []);
  const [items, setItems] = useState<any[]>([]);

  // Initialize form when editingInvoice changes
  useEffect(() => {
    if (editingInvoice) {
      setCustomerId(editingInvoice.customer.id);
      setInvoiceNo(editingInvoice.number);
      setInvoiceDate(editingInvoice.createdAt?.split('T')[0] || new Date().toISOString().slice(0,10));
      setDueDate(editingInvoice.dueDate || "");
      setReference(editingInvoice.reference || "");
      setNotes(editingInvoice.notes || "");
      setDiscountPct(editingInvoice.discountPct || 0);
      setShipping(editingInvoice.shipping || 0);
      setUseShippingAddress(editingInvoice.useShippingAddress || false);
      setItems(editingInvoice.items || []);
    } else {
      // Reset for new invoice
      setCustomerId(preselectedCustomerId || customers[0]?.id || "");
      setInvoiceNo(`INV-${new Date().getFullYear()}-${Math.floor(Math.random()*9000+1000)}`);
      setInvoiceDate(new Date().toISOString().slice(0,10));
      setDueDate(() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toISOString().slice(0,10);
      });
      setReference("");
      setNotes("");
      setDiscountPct(0);
      setShipping(0);
      setUseShippingAddress(false);
      // Ensure we always start with at least one item
      const defaultProduct = products[0] || { name: "New Item", price: 0, description: "" };
      setItems([{ 
        id: `li_${Date.now()}`, 
        name: defaultProduct.name, 
        qty: 1, 
        price: defaultProduct.price, 
        description: defaultProduct.description 
      }]);
    }
  }, [editingInvoice, preselectedCustomerId, customers, products]);

  const addItem = () => {
  const defaultProduct = products[0] || { name: "New Item", price: 0, description: "" };
  const newItem = { 
    id: `li_${Date.now()}`, 
    name: defaultProduct.name, 
    qty: 1, 
    price: defaultProduct.price, 
    description: defaultProduct.description 
  };
  setItems(prev => [...prev, newItem]);
};
  const removeItem = (id: string) => setItems(prev => prev.filter(i=> i.id!==id));
  const updateItem = (id: string, patch: Partial<any>) => {
  setItems(prev => prev.map(i=> i.id===id ? { ...i, ...patch } : i));
};

  const computeTotals = () => {
    const sub = items.reduce((s, i) => s + i.qty * i.price, 0);
    const discount = discountPct ? (sub * discountPct) / 100 : 0;
    const shippingAmount = shipping || 0;
    const tax = 0; // You can add tax logic if needed
    const grand = sub - discount + shippingAmount + tax;
    return { sub, discount, shipping: shippingAmount, tax, grand };
  };

  const save = () => {
    if (!customerId) { toast({ title: "Customer required", variant: "destructive" }); return; }
    if (items.length===0 || items.some(i=> !i.name.trim())) { toast({ title: "Add at least one item", variant: "destructive" }); return; }
    
    const invoice: Invoice = {
      id: editingInvoice?.id || `inv_${Date.now()}`,
      number: invoiceNo,
      customer: customers.find(c => c.id === customerId)!,
      items,
      status: editingInvoice?.status || "sent",
      createdAt: editingInvoice?.createdAt || invoiceDate,
      updatedAt: new Date().toISOString(),
      discountPct,
      shipping,
      useShippingAddress,
      dueDate,
      reference,
      notes,
    };
    
    onAdd(invoice);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingInvoice ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
          <DialogDescription>
            {editingInvoice ? "Edit the invoice details and line items." : "Fill in the invoice details and add line items to create a new invoice."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer</label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Invoice Number</label>
              <Input value={invoiceNo} onChange={(e)=> setInvoiceNo(e.target.value)} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Invoice Date</label>
              <Input type="date" value={invoiceDate} onChange={(e)=> setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Input type="date" value={dueDate} onChange={(e)=> setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reference</label>
            <Input value={reference} onChange={(e)=> setReference(e.target.value)} placeholder="Optional reference number" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Input value={notes} onChange={(e)=> setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <div className="space-y-4">
            <div className="font-medium">Line Items</div>
            <div className="rounded-lg border p-4">
              <Table key={items.length}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {products.length > 0 ? (
                        <Select value={item.name} onValueChange={(value)=> {
                          const selectedProduct = products.find(p => p.name === value);
                          updateItem(item.id, { 
                            name: value, 
                            price: selectedProduct?.price || item.price,
                            description: selectedProduct?.description || item.description 
                          });
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.name}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input 
                          value={item.name} 
                          onChange={(e)=> updateItem(item.id, { name: e.target.value })}
                          placeholder="Enter item name"
                        />
                      )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" value={item.qty} onChange={(e)=> updateItem(item.id, { qty: parseInt(e.target.value) || 0 })} className="w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" value={item.price} onChange={(e)=> updateItem(item.id, { price: parseFloat(e.target.value) || 0 })} className="w-24" />
                      </TableCell>
                      <TableCell className="text-right">
                        {(item.qty * item.price).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={()=> removeItem(item.id)}>Remove</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" onClick={addItem} className="mt-2">Add Line Item</Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Discount %</label>
                <Input type="number" value={discountPct} onChange={(e)=> setDiscountPct(parseFloat(e.target.value)||0)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Shipping</label>
                <Input type="number" value={shipping} onChange={(e)=> setShipping(parseFloat(e.target.value)||0)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Use Shipping Address</label>
                <input type="checkbox" checked={useShippingAddress} onChange={(e)=> setUseShippingAddress(e.target.checked)} />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Subtotal: {computeTotals().sub.toFixed(2)}</div>
                <div>Discount: {computeTotals().discount.toFixed(2)}</div>
                <div>Shipping: {computeTotals().shipping.toFixed(2)}</div>
                <div>Tax: {computeTotals().tax.toFixed(2)}</div>
                <div className="font-semibold">Total: {computeTotals().grand.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=> onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Create Invoice</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState(AccountingStore.listInvoices());
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const c = CompanySettingsStore.get();
  const createMode = searchParams.get('create') === 'true';
  const preselectedCustomerId = searchParams.get('customerId');
  const [open, setOpen] = useState(createMode);
  const [editOpen, setEditOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | undefined>(undefined);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>(undefined);
  
  // Check for overdue invoices and create notifications
  const checkOverdueInvoices = () => {
    const today = new Date();
    const overdueInvoices = invoices.filter(inv => {
      if (inv.status === 'paid' || inv.status === 'overdue') return false;
      if (!inv.dueDate) return false;
      const dueDate = new Date(inv.dueDate);
      return dueDate < today;
    });
    
    // Update overdue status
    overdueInvoices.forEach(inv => {
      AccountingStore.upsertInvoice({ ...inv, status: 'overdue' });
    });
    
    // Store overdue notifications for dashboard
    if (overdueInvoices.length > 0) {
      localStorage.setItem('overdue_invoices', JSON.stringify({
        count: overdueInvoices.length,
        invoices: overdueInvoices.map(inv => ({
          id: inv.id,
          number: inv.number,
          customer: inv.customer.name,
          dueDate: inv.dueDate,
          daysOverdue: Math.floor((today.getTime() - new Date(inv.dueDate!).getTime()) / (1000 * 60 * 60 * 24))
        })),
        lastChecked: today.toISOString()
      }));
      
      // Show notification
      toast({
        title: "Overdue Invoices Detected",
        description: `${overdueInvoices.length} invoice(s) are overdue and have been flagged.`,
        variant: "destructive"
      });
    }
  };
  
  const total = useMemo(() => (i: Invoice) => i.items.reduce((s, it) => s + it.qty * it.price, 0), []);
  const paidAmt = (i: Invoice) => {
    const payments = PaymentStore.byInvoice(i.id);
    const amount = PaymentStore.sumAmount(payments);
    console.log(`Invoice ${i.id} payments:`, payments, 'Total paid:', amount);
    return amount;
  };
  const creditsApplied = (i: Invoice) => CreditNotesStore.sumAppliedToInvoice(i.id);
  const balance = (i: Invoice) => {
    const totalAmount = total(i);
    const paidAmount = paidAmt(i);
    const credits = creditsApplied(i);
    const balanceAmount = Math.max(0, totalAmount - paidAmount - credits);
    console.log(`Invoice ${i.id} balance calculation:`, { totalAmount, paidAmount, credits, balanceAmount });
    return balanceAmount;
  };

  useEffect(() => {
    const refresh = () => {
      setInvoices(AccountingStore.listInvoices());
      checkOverdueInvoices(); // Check for overdue invoices after refresh
    };
    const onPayments = () => {
      console.log('Payments changed, refreshing invoices...');
      refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("acct.payments") || e.key.startsWith("acct.invoices")) {
        console.log('Storage changed, refreshing invoices...', e.key);
        refresh();
      }
      if (e.key.startsWith("enhanced-companies-changed") || e.key.startsWith("enhanced-current-company-changed")) {
        refresh(); // Refresh invoices when company changes
      }
    };
    
    window.addEventListener('payments-changed', onPayments as EventListener);
    window.addEventListener('storage', onStorage);
    
    // Listen for company changes
    window.addEventListener('enhanced-companies-changed', refresh);
    window.addEventListener('enhanced-current-company-changed', refresh);
    
    // Initial refresh
    refresh();
    
    // Check for overdue invoices every hour
    const overdueCheckInterval = setInterval(checkOverdueInvoices, 60 * 60 * 1000);
    
    return () => {
      window.removeEventListener('payments-changed', onPayments as EventListener);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('enhanced-companies-changed', refresh);
      window.removeEventListener('enhanced-current-company-changed', refresh);
      clearInterval(overdueCheckInterval);
    };
  }, []);

  const addInvoice = (inv: Invoice) => {
    AccountingStore.upsertInvoice(inv);
    setInvoices(AccountingStore.listInvoices());
    const isEdit = editingInvoice?.id === inv.id;
    toast({ 
      title: isEdit ? "Invoice Updated" : "Invoice Added", 
      description: inv.number 
    });
    if (isEdit) {
      setEditOpen(false);
      setEditingInvoice(undefined);
    } else {
      setOpen(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Invoices</CardTitle>
          <Button onClick={()=> setOpen(true)}>New Invoice</Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border max-h-60 overflow-y-auto">
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
                    <TableCell>
                      <Badge variant={i.status === 'paid' ? 'default' : i.status === 'overdue' ? 'destructive' : 'secondary'}>
                        {i.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{c.currencySymbol}{paidAmt(i).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{c.currencySymbol}{balance(i).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => { setEditingInvoice(i); setEditOpen(true); }}
                          aria-label="Edit invoice"
                          title="Edit invoice"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => navigate(`/accounting/invoices/${i.id}/print`)}
                          aria-label="Print / download PDF"
                          title="Print / download PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          onClick={() => { setActiveInvoice(i); setPaymentOpen(true); }}
                          aria-label="Capture payment"
                          title="Capture payment"
                        >
                          <CreditCard className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete invoice ${i.number}? This action cannot be undone.`)) {
                              AccountingStore.removeInvoice(i.id);
                              setInvoices(AccountingStore.listInvoices());
                              toast({ 
                                title: "Invoice Deleted", 
                                description: `Invoice ${i.number} has been deleted.`,
                                variant: "destructive"
                              });
                            }
                          }}
                          aria-label="Delete invoice"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <NewInvoiceDialog open={open} onOpenChange={setOpen} onAdd={addInvoice} preselectedCustomerId={preselectedCustomerId || undefined} />
      <NewInvoiceDialog open={editOpen} onOpenChange={(v)=> { setEditOpen(v); if (!v) setEditingInvoice(undefined); }} onAdd={addInvoice} editingInvoice={editingInvoice} />
      <CapturePaymentDialog 
        open={paymentOpen} 
        onOpenChange={setPaymentOpen} 
        context={{ invoice: activeInvoice }} 
        onSaved={() => {
          setInvoices(AccountingStore.listInvoices());
          setPaymentOpen(false);
          setActiveInvoice(undefined);
        }}
      />
    </div>
  );
};

export default Invoices;
