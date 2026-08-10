import React, { useState } from "react";
import { UserCheck } from "lucide-react";
import { AuthStore } from "@/lib/authStore";
import { RolesStore } from "@/lib/rolesStore";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/use-toast";

type PendingRequest = ReturnType<typeof AuthStore.listPending>[number];

const PendingApprovals: React.FC = () => {
  const [pending, setPending] = useState<PendingRequest[]>(() => AuthStore.listPending());
  const roles = RolesStore.list();
  const defaultRoleId = roles.find((r) => r.id === "role_employee")?.id || roles[0]?.id || "";

  // The chosen role per request. This previously assigned onto the request
  // object itself, which mutated store data and never triggered a re-render.
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});

  const approve = (request: PendingRequest) => {
    const roleId = selectedRoles[request.id] || defaultRoleId;
    AuthStore.adminApprove(request.id, roleId);
    setPending(AuthStore.listPending());
    toast({
      title: "Access approved",
      description: `${request.name} can now sign in as ${roles.find((r) => r.id === roleId)?.name ?? "a user"}.`,
    });
  };

  const columns: Column<PendingRequest>[] = [
    { id: "name", header: "Name", sortValue: (p) => p.name, cell: (p) => <span className="font-medium">{p.name}</span> },
    { id: "email", header: "Email", sortValue: (p) => p.email, cell: (p) => <span className="text-muted-foreground">{p.email}</span> },
    {
      id: "requested",
      header: "Requested",
      hideOnMobile: true,
      sortValue: (p) => p.requestedAt,
      cell: (p) => <span className="whitespace-nowrap text-muted-foreground">{new Date(p.requestedAt).toLocaleString()}</span>,
    },
    {
      id: "role",
      header: "Assign role",
      width: "16rem",
      cell: (p) => (
        <Select
          value={selectedRoles[p.id] || defaultRoleId}
          onValueChange={(v) => setSelectedRoles((prev) => ({ ...prev, [p.id]: v }))}
        >
          <SelectTrigger className="h-9 w-full" aria-label={`Role for ${p.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (p) => (
        <Button size="sm" className="h-9" onClick={() => approve(p)}>
          Approve
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Pending access requests"
        description="People who've asked for an account. Assign a role, then approve."
        breadcrumbs={[{ label: "Users", to: "/users" }, { label: "Pending approvals" }]}
      />

      <DataTable
        rows={pending}
        columns={columns}
        rowKey={(p) => p.id}
        searchAccessor={(p) => `${p.name} ${p.email}`}
        searchPlaceholder="Search requests…"
        empty={{
          title: "Nothing waiting",
          description: "New access requests will appear here for approval.",
        }}
      />

      {pending.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Approving grants immediate sign-in access with the role you select.
        </p>
      )}
    </div>
  );
};

export default PendingApprovals;
