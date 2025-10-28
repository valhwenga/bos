import { useMemo, useState } from "react";
import { CrmCustomersStore, type CrmCustomer } from "@/lib/crmCustomersStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

const Customers = () => {
  const [list, setList] = useState(CrmCustomersStore.list());
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const filtered = useMemo(() => list.filter(c => {
    const hay = `${c.name} ${c.address||''} ${(c.contacts||[]).map(x=>x.name).join(' ')}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [list, q]);

  const add = () => {
    const c: CrmCustomer = { id: `C_${Date.now()}`, name: "New Customer", contacts: [], createdAt: new Date().toISOString() };
    CrmCustomersStore.upsert(c); setList(CrmCustomersStore.list());
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Customers</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="Search" value={q} onChange={(e)=> setQ(e.target.value)} />
            <Button onClick={add}>New Customer</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.address||'-'}</TableCell>
                    <TableCell>{(c.contacts||[]).map(x=>x.name).join(', ')||'-'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={()=> navigate(`/crm/customers/${c.id}`)}>Open</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Customers;
