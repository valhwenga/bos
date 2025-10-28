import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AvatarGroup } from "@/components/AvatarGroup";
import { HRMDepartmentsStore, type Department } from "@/lib/hrmDepartmentsStore";
import { HRMStore } from "@/lib/hrmStore";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const HRMDepartments = () => {
  const [list, setList] = useState<Department[]>(HRMDepartmentsStore.list());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<Department>({ id: "", name: "", head: "", employees: 0, description: "", color: "bg-blue-500" });

  const refresh = () => setList(HRMDepartmentsStore.list());
  const startAdd = () => { setEditing(null); setForm({ id: `D${Math.floor(Math.random()*900+100)}`, name: "", head: "", employees: 0, description: "", color: "bg-blue-500" }); setOpen(true); };
  const startEdit = (d: Department) => { setEditing(d); setForm(d); setOpen(true); };
  const remove = (id: string) => { HRMDepartmentsStore.remove(id); refresh(); };
  const save = () => { if(!form.name.trim()) return; HRMDepartmentsStore.upsert(form); setOpen(false); refresh(); };
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage Departments</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>HRM System</span>
            <span>›</span>
            <span className="text-primary">Departments</span>
          </div>
        </div>

        <Button size="sm" onClick={startAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {list.map((dept) => (
          <Card key={dept.id} className="p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-lg ${dept.color} flex items-center justify-center`}>
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={()=> startEdit(dept)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={()=> remove(dept.id)}>
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <h3 className="text-xl font-semibold mb-2">{dept.name}</h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{dept.description}</p>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Department Head</span>
                <span className="font-medium">{dept.head}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Employees</span>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  {HRMStore.list().filter(e => (e.departmentId ? e.departmentId === dept.id : e.department === dept.name)).length}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">TEAM MEMBERS</p>
              <AvatarGroup members={[]} max={4} />
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">ID</label>
              <Input value={form.id} onChange={(e)=> setForm({ ...form, id: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={form.name} onChange={(e)=> setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Head</label>
              <Input value={form.head || ""} onChange={(e)=> setForm({ ...form, head: e.target.value })} />
            </div>
            
            <div className="grid gap-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Description</label>
              <Input value={form.description || ""} onChange={(e)=> setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRMDepartments;
