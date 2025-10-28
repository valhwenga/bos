import { useEffect, useState } from "react";
import { EmailStore, type SMTPSettings } from "@/lib/emailStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const EmailSettings = () => {
  const [s, setS] = useState<SMTPSettings>(EmailStore.smtp());
  useEffect(()=> setS(EmailStore.smtp()), []);

  const save = () => { EmailStore.setSmtp(s); };
  const test = async () => {
    alert("Test email would be sent here using your SMTP settings. Implement actual sending via backend.");
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-3xl font-bold mb-2">Email (SMTP) Settings</h1>
        <div className="text-sm text-muted-foreground">Configure SMTP credentials used by the Email module.</div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="flex items-center justify-between border rounded p-3">
          <div>
            <div className="font-medium">Enable SMTP</div>
            <div className="text-xs text-muted-foreground">Toggle email module connectivity</div>
          </div>
          <Switch checked={!!s.enabled} onCheckedChange={(v)=> setS({ ...s, enabled: v })} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Host</label>
          <Input value={s.host} onChange={(e)=> setS({ ...s, host: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Port</label>
          <Input type="number" value={s.port} onChange={(e)=> setS({ ...s, port: parseInt(e.target.value||"0") })} />
        </div>
        <div className="flex items-center justify-between border rounded p-3">
          <div>
            <div className="font-medium">Use TLS (secure)</div>
            <div className="text-xs text-muted-foreground">Enable STARTTLS/SSL</div>
          </div>
          <Switch checked={!!s.secure} onCheckedChange={(v)=> setS({ ...s, secure: v })} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Username</label>
          <Input value={s.username} onChange={(e)=> setS({ ...s, username: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Password</label>
          <Input type="password" value={s.password} onChange={(e)=> setS({ ...s, password: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">From Name</label>
          <Input value={s.fromName||''} onChange={(e)=> setS({ ...s, fromName: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">From Email</label>
          <Input value={s.fromEmail||''} onChange={(e)=> setS({ ...s, fromEmail: e.target.value })} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={test}>Send Test Email</Button>
        <Button onClick={save}>Save</Button>
      </div>
    </div>
  );
};

export default EmailSettings;
