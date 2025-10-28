import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { UserStore, type User } from "@/lib/userStore";
import { toast } from "@/components/ui/use-toast";
import { HRMDepartmentsStore } from "@/lib/hrmDepartmentsStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const Profile: React.FC = () => {
  const [u, setU] = useState<User>(UserStore.get());

  const onAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const img = new Image();
        img.onload = () => {
          const MAX = 256;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            setU({ ...u, avatarDataUrl: dataUrl });
          } else {
            setU({ ...u, avatarDataUrl: String(reader.result) });
          }
        };
        img.src = String(reader.result);
      } catch (err) {
        setU({ ...u, avatarDataUrl: String(reader.result) });
      }
    };
    reader.readAsDataURL(f);
  };
  const save = () => {
    try {
      UserStore.set(u);
      window.dispatchEvent(new Event("user-profile-changed"));
      toast({ title: "Profile saved" });
    } catch (err) {
      toast({ title: "Failed to save", description: "Try a smaller profile photo.", variant: "destructive" });
    }
  };

  const initials = (u.name || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            {u.avatarDataUrl ? (
              <img src={u.avatarDataUrl} alt="avatar" className="h-16 w-16 rounded-full object-cover border" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-medium">
                {initials}
              </div>
            )}
            <div>
              <Input type="file" accept="image/*" onChange={onAvatar} />
              {u.avatarDataUrl && (
                <Button variant="secondary" className="mt-2" onClick={()=> setU({ ...u, avatarDataUrl: undefined })}>Remove</Button>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Full Name</label>
              <Input value={u.name} onChange={(e)=> setU({ ...u, name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={u.email || ""} onChange={(e)=> setU({ ...u, email: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={u.title || ""} onChange={(e)=> setU({ ...u, title: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Department (name)</label>
              <Input value={u.department || ""} onChange={(e)=> setU({ ...u, department: e.target.value })} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Primary Department (ID)</Label>
              <Select value={u.departmentId || ""} onValueChange={(val)=> setU({ ...u, departmentId: val || undefined })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {HRMDepartmentsStore.list().map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name} ({d.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Departments You Manage</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {HRMDepartmentsStore.list().map(d => {
                  const checked = (u.managedDepartmentIds || []).includes(d.id);
                  return (
                    <label key={d.id} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v)=> {
                          const cur = new Set(u.managedDepartmentIds || []);
                          if (v) cur.add(d.id); else cur.delete(d.id);
                          setU({ ...u, managedDepartmentIds: Array.from(cur) });
                        }}
                      />
                      <span className="text-sm">{d.name} ({d.id})</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Used to scope dashboards if your role is Department/Team level.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save}>Save Profile</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
