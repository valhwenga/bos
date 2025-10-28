import React, { useMemo, useState } from "react";
import { AuthStore } from "@/lib/authStore";
import { RolesStore } from "@/lib/rolesStore";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PendingApprovals: React.FC = () => {
  const [tick, setTick] = useState(0);
  const pending = AuthStore.listPending();
  const roles = RolesStore.list();
  const roleDefault = roles.find(r=> r.id==='role_company_admin')?.id || roles[0]?.id || '';

  const approve = (pendingId: string, roleId: string) => {
    AuthStore.adminApprove(pendingId, roleId);
    setTick(t=>t+1);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="text-2xl font-semibold">Pending Signups</div>
      <div className="text-sm text-muted-foreground">Approve access requests and assign a role.</div>
      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Requested</th>
              <th className="text-left p-3">Role</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.length===0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No pending requests.</td></tr>
            )}
            {pending.map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">{p.email}</td>
                <td className="p-3">{new Date(p.requestedAt).toLocaleString()}</td>
                <td className="p-3">
                  <Select defaultValue={roleDefault} onValueChange={(v)=> (p as any)._role = v}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-right">
                  <Button onClick={()=> approve(p.id, (p as any)._role || roleDefault)}>Approve</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PendingApprovals;
