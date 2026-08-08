import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProvinceSelect } from "@/components/ProvinceSelect";
import { CustomersStore, type Customer, type CustomerAddress } from "@/lib/customersStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanySettingsStore } from "@/lib/companySettings";

const emptyAddress = (): CustomerAddress => ({ line1: "", line2: "", city: "", state: "", postalCode: "", country: "" });

const CustomerDialog: React.FC<{ open: boolean; onOpenChange: (v:boolean)=>void; customer?: Customer; onSaved: () => void }>= ({ open, onOpenChange, customer, onSaved }) => {
  const [c, setC] = useState<Customer>(customer || { id: `c_${Date.now()}`, name: "", email: "", companyName: "", phone: "", taxNumber: "", billingAddress: emptyAddress(), shippingAddress: emptyAddress(), shippingSameAsBilling: true, responsible: { name: "", email: "", phone: "", title: "" }, tags: [] });

  useEffect(()=> { if (customer) setC({ ...customer }); }, [customer]);

  const copyBillingToShipping = () => {
    setC(prev => ({ ...prev, shippingAddress: { ...(prev.billingAddress||{}) }, shippingSameAsBilling: true }));
  };

  const save = () => {
    if (!c.name.trim()) return;
    if (c.shippingSameAsBilling) c.shippingAddress = { ...(c.billingAddress||{}) };
    CustomersStore.upsert(c);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Customer Name</label>
              <Input value={c.name} onChange={(e)=> setC({ ...c, name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Company Name</label>
              <Input value={c.companyName || ""} onChange={(e)=> setC({ ...c, companyName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Email</label>
                <Input value={c.email || ""} onChange={(e)=> setC({ ...c, email: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Phone</label>
                <Input value={c.phone || ""} onChange={(e)=> setC({ ...c, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Tax/VAT Number</label>
              <Input value={c.taxNumber || ""} onChange={(e)=> setC({ ...c, taxNumber: e.target.value })} />
            </div>

            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Responsible Person</label>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={c.responsible?.name || ""} onChange={(e)=> setC({ ...c, responsible: { ...(c.responsible||{}), name: e.target.value } })} />
                <Input placeholder="Title" value={c.responsible?.title || ""} onChange={(e)=> setC({ ...c, responsible: { ...(c.responsible||{}), title: e.target.value } })} />
                <Input placeholder="Email" value={c.responsible?.email || ""} onChange={(e)=> setC({ ...c, responsible: { ...(c.responsible||{}), email: e.target.value } })} />
                <Input placeholder="Phone" value={c.responsible?.phone || ""} onChange={(e)=> setC({ ...c, responsible: { ...(c.responsible||{}), phone: e.target.value } })} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-2">
              <div className="font-medium">Billing Address</div>
              <Input placeholder="Address line 1" value={c.billingAddress?.line1 || ""} onChange={(e)=> setC({ ...c, billingAddress: { ...(c.billingAddress||{}), line1: e.target.value } })} />
              <Input placeholder="Address line 2" value={c.billingAddress?.line2 || ""} onChange={(e)=> setC({ ...c, billingAddress: { ...(c.billingAddress||{}), line2: e.target.value } })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City" value={c.billingAddress?.city || ""} onChange={(e)=> setC({ ...c, billingAddress: { ...(c.billingAddress||{}), city: e.target.value } })} />
                <ProvinceSelect 
                  value={c.billingAddress?.state || ""} 
                  onValueChange={(value)=> setC({ ...c, billingAddress: { ...(c.billingAddress||{}), state: value } })}
                  placeholder="Select Province"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Postal Code" value={c.billingAddress?.postalCode || ""} onChange={(e)=> setC({ ...c, billingAddress: { ...(c.billingAddress||{}), postalCode: e.target.value } })} />
                <Input placeholder="Country" value={c.billingAddress?.country || ""} onChange={(e)=> setC({ ...c, billingAddress: { ...(c.billingAddress||{}), country: e.target.value } })} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={!!c.shippingSameAsBilling} onCheckedChange={(v)=> setC({ ...c, shippingSameAsBilling: !!v })} />
              <span className="text-sm">Shipping address same as billing</span>
              <Button variant="outline" size="sm" className="ml-auto" onClick={copyBillingToShipping}>Copy billing to shipping</Button>
            </div>

            <div className="grid gap-2">
              <div className="font-medium">Shipping Address</div>
              <Input placeholder="Address line 1" value={c.shippingAddress?.line1 || ""} onChange={(e)=> setC({ ...c, shippingAddress: { ...(c.shippingAddress||{}), line1: e.target.value } })} disabled={!!c.shippingSameAsBilling} />
              <Input placeholder="Address line 2" value={c.shippingAddress?.line2 || ""} onChange={(e)=> setC({ ...c, shippingAddress: { ...(c.shippingAddress||{}), line2: e.target.value } })} disabled={!!c.shippingSameAsBilling} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City" value={c.shippingAddress?.city || ""} onChange={(e)=> setC({ ...c, shippingAddress: { ...(c.shippingAddress||{}), city: e.target.value } })} disabled={!!c.shippingSameAsBilling} />
                <ProvinceSelect 
                  value={c.shippingAddress?.state || ""} 
                  onValueChange={(value)=> setC({ ...c, shippingAddress: { ...(c.shippingAddress||{}), state: value } })}
                  disabled={!!c.shippingSameAsBilling}
                  placeholder="Select Province"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Postal Code" value={c.shippingAddress?.postalCode || ""} onChange={(e)=> setC({ ...c, shippingAddress: { ...(c.shippingAddress||{}), postalCode: e.target.value } })} disabled={!!c.shippingSameAsBilling} />
                <Input placeholder="Country" value={c.shippingAddress?.country || ""} onChange={(e)=> setC({ ...c, shippingAddress: { ...(c.shippingAddress||{}), country: e.target.value } })} disabled={!!c.shippingSameAsBilling} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={()=> onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!c.name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Customers: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | undefined>(undefined);
  const [viewing, setViewing] = useState<Customer | undefined>(undefined);
  const [q, setQ] = useState("");
  const [list, setList] = useState(CustomersStore.list());

  useEffect(() => {
    const refresh = () => setList(CustomersStore.list());
    const onStorage = (e: StorageEvent) => { if (e.key && e.key.startsWith('crm.customers')) refresh(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const filtered = useMemo(() => list.filter(c =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.companyName||"").toLowerCase().includes(q.toLowerCase()) || (c.email||"").toLowerCase().includes(q.toLowerCase())
  ), [list, q]);

  const remove = (id: string) => { CustomersStore.remove(id); setList(CustomersStore.list()); };

  const CustomerDetails: React.FC<{ customer: Customer }> = ({ customer }) => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{customer.name}</h3>
                <p className="text-muted-foreground">{customer.companyName || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-lg">{customer.email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <p className="text-lg">{customer.phone || '-'}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Tax Number</label>
                <p className="text-lg">{customer.taxNumber || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Responsible Person</label>
                <div className="space-y-1">
                  <p className="text-lg">{customer.responsible?.name || '-'}</p>
                  <p className="text-sm text-muted-foreground">{customer.responsible?.title || '-'}</p>
                  <p className="text-sm text-muted-foreground">{customer.responsible?.email || '-'}</p>
                  <p className="text-sm text-muted-foreground">{customer.responsible?.phone || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => window.location.href = `mailto:${customer.email}`} className="w-full">
                  Send Email
                </Button>
                <Button onClick={() => window.open(`tel:${customer.phone}`)} className="w-full">
                  Call Customer
                </Button>
                <Button onClick={() => window.location.href = `/accounting/invoices?customerId=${customer.id}`} className="w-full">
                  View Invoices
                </Button>
                <Button onClick={() => window.location.href = `/accounting/quotations?customerId=${customer.id}`} className="w-full">
                  View Quotes
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.location.href = `/accounting/invoices?create=true&customerId=${customer.id}`} className="w-full">
                  Create Invoice
                </Button>
                <Button size="sm" onClick={() => window.location.href = `/accounting/quotations?create=true&customerId=${customer.id}`} className="w-full">
                  Create Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Addresses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Billing Address</h4>
                <div className="text-sm space-y-1">
                  <p>{customer.billingAddress?.line1 || '-'}</p>
                  <p>{customer.billingAddress?.line2 || '-'}</p>
                  <p>{customer.billingAddress?.city || '-'}, {customer.billingAddress?.state || '-'}</p>
                  <p>{customer.billingAddress?.postalCode || '-'}</p>
                  <p>{customer.billingAddress?.country || '-'}</p>
                </div>
              </div>
              {customer.shippingAddress && !customer.shippingSameAsBilling && (
                <div>
                  <h4 className="font-medium mb-2">Shipping Address</h4>
                  <div className="text-sm space-y-1">
                    <p>{customer.shippingAddress?.line1 || '-'}</p>
                    <p>{customer.shippingAddress?.line2 || '-'}</p>
                    <p>{customer.shippingAddress?.city || '-'}, {customer.shippingAddress?.state || '-'}</p>
                    <p>{customer.shippingAddress?.postalCode || '-'}</p>
                    <p>{customer.shippingAddress?.country || '-'}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Customers</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="Search name/company/email" value={q} onChange={(e)=> setQ(e.target.value)} className="w-64" />
            <Button onClick={()=> { setEdit(undefined); setOpen(true); }}>New Customer</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Responsible</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Button 
                        variant="link" 
                        onClick={() => setViewing(c)} 
                        className="text-left hover:underline p-0 h-auto"
                      >
                        {c.name}
                      </Button>
                    </TableCell>
                    <TableCell>{c.companyName}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.responsible?.name}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="secondary" onClick={()=> { setEdit(c); setOpen(true); }}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={()=> remove(c.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CustomerDialog open={open} onOpenChange={(v)=> { setOpen(v); if (!v) { setEdit(undefined); setList(CustomersStore.list()); } }} customer={edit} onSaved={()=> setList(CustomersStore.list())} />
      
      {viewing && (
        <Dialog open={true} onOpenChange={() => setViewing(undefined)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <CardTitle>Customer Details</CardTitle>
            </DialogHeader>
            <CustomerDetails customer={viewing} />
            <div className="flex justify-end">
              <Button onClick={() => setViewing(undefined)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Customers;
