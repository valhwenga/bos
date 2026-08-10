import { useMemo, useState } from "react";
import { Building2, Users } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
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

  const columns: Column<CrmCustomer>[] = [
    { id: "name", header: "Name", sortValue: (c) => c.name, cell: (c) => <span className="font-medium">{c.name}</span> },
    {
      id: "address",
      header: "Address",
      hideOnMobile: true,
      cell: (c) => <span className="block max-w-xs truncate text-muted-foreground">{c.address || "—"}</span>,
    },
    {
      id: "contacts",
      header: "Contacts",
      cell: (c) => {
        const names = (c.contacts || []).map((x) => x.name).filter(Boolean);
        return names.length ? (
          <span className="text-muted-foreground">{names.join(", ")}</span>
        ) : (
          <span className="text-subtle">No contacts</span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Customers"
        description="Accounts you're actively working with in CRM."
        breadcrumbs={[{ label: "CRM", to: "/crm/leads" }, { label: "Customers" }]}
        actions={<Button onClick={add}>New customer</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Customers" value={filtered.length} hint="In your CRM" icon={Building2} />
          <StatCard
            label="With contacts"
            value={filtered.filter((c) => (c.contacts || []).length > 0).length}
            hint="Have at least one named contact"
            icon={Users}
          />
        </div>
      </PageHeader>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(c) => c.id}
        searchAccessor={(c) => `${c.name} ${c.address ?? ""} ${(c.contacts || []).map((x) => x.name).join(" ")}`}
        searchPlaceholder="Search by name, address or contact…"
        onRowClick={(c) => navigate(`/crm/customers/${c.id}`)}
        empty={{
          title: "No customers yet",
          description: "Convert a won lead, or add a customer directly.",
          action: <Button onClick={add}>New customer</Button>,
        }}
      />
    </div>
  );
};

export default Customers;
