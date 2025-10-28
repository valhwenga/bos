import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CrmCustomersStore, type CrmCustomer, type ContactPerson } from "@/lib/crmCustomersStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canAccess } from "@/lib/accessControl";

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<CrmCustomer | undefined>(undefined);
  const [newContact, setNewContact] = useState<ContactPerson>({ id: "", name: "", email: "", phone: "", role: "" });

  const refresh = () => setC(id ? CrmCustomersStore.get(id) : undefined);
  useEffect(()=> { refresh(); }, [id]);

  if (!c) return (
    <div className="p-6">
      <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
      <div className="mt-4">Customer not found</div>
    </div>
  );

  const update = (patch: Partial<CrmCustomer>) => { const next = { ...c, ...patch } as CrmCustomer; CrmCustomersStore.upsert(next); setC(next); };

  const addContact = () => {
    if (!newContact.name.trim()) return;
    const cp = { ...newContact, id: `p_${Date.now()}` } as ContactPerson;
    update({ contacts: [...(c.contacts||[]), cp] });
    setNewContact({ id: "", name: "", email: "", phone: "", role: "" });
  };
  const removeContact = (pid: string) => update({ contacts: (c.contacts||[]).filter(x=> x.id!==pid) });

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Customer Detail</CardTitle>
          <div className="flex items-center gap-2">
            {canAccess('crm','full') && (
              <Button variant="destructive" onClick={()=> { if (c?.id) { CrmCustomersStore.remove(c.id); navigate(-1); } }}>Delete</Button>
            )}
            <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={c.name} onChange={(e)=> update({ name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Tax Number</label>
              <Input value={c.taxNumber||""} onChange={(e)=> update({ taxNumber: e.target.value })} />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Address</label>
              <Input value={c.address||""} onChange={(e)=> update({ address: e.target.value })} />
            </div>
          </div>

          <div className="mt-4">
            <div className="font-medium mb-2">Contacts</div>
            <div className="space-y-2">
              {(c.contacts||[]).map(p => (
                <div key={p.id} className="grid md:grid-cols-5 gap-2 items-center">
                  <Input value={p.name} onChange={(e)=> update({ contacts: (c.contacts||[]).map(x=> x.id===p.id ? { ...x, name: e.target.value } : x) })} />
                  <Input value={p.email||""} onChange={(e)=> update({ contacts: (c.contacts||[]).map(x=> x.id===p.id ? { ...x, email: e.target.value } : x) })} />
                  <Input value={p.phone||""} onChange={(e)=> update({ contacts: (c.contacts||[]).map(x=> x.id===p.id ? { ...x, phone: e.target.value } : x) })} />
                  <Input value={p.role||""} onChange={(e)=> update({ contacts: (c.contacts||[]).map(x=> x.id===p.id ? { ...x, role: e.target.value } : x) })} />
                  <Button variant="outline" size="sm" onClick={()=> removeContact(p.id)}>Remove</Button>
                </div>
              ))}
              <div className="grid md:grid-cols-5 gap-2 items-center">
                <Input placeholder="Name" value={newContact.name} onChange={(e)=> setNewContact({ ...newContact, name: e.target.value })} />
                <Input placeholder="Email" value={newContact.email||""} onChange={(e)=> setNewContact({ ...newContact, email: e.target.value })} />
                <Input placeholder="Phone" value={newContact.phone||""} onChange={(e)=> setNewContact({ ...newContact, phone: e.target.value })} />
                <Input placeholder="Role" value={newContact.role||""} onChange={(e)=> setNewContact({ ...newContact, role: e.target.value })} />
                <Button size="sm" onClick={addContact}>Add</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerDetail;
