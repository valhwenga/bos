import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsAppSettingsStore } from "@/lib/whatsappSettings";

const WhatsAppSettingsPage: React.FC = () => {
  const [s, setS] = useState(WhatsAppSettingsStore.get());
  const save = () => { WhatsAppSettingsStore.set(s); alert('Saved'); };
  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader><CardTitle>WhatsApp Business (Cloud API) Settings</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Phone Number ID</label>
            <Input value={s.phoneNumberId||''} onChange={(e)=> setS({ ...s, phoneNumberId: e.target.value })} placeholder="e.g. 123456789012345" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Business Account ID</label>
            <Input value={s.businessAccountId||''} onChange={(e)=> setS({ ...s, businessAccountId: e.target.value })} placeholder="e.g. 123456789012345" />
          </div>
          <div className="grid gap-1 md:col-span-2">
            <label className="text-xs text-muted-foreground">Access Token</label>
            <Input value={s.accessToken||''} onChange={(e)=> setS({ ...s, accessToken: e.target.value })} placeholder="DO NOT COMMIT REAL TOKENS" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Verify Token (webhook)</label>
            <Input value={s.verifyToken||''} onChange={(e)=> setS({ ...s, verifyToken: e.target.value })} placeholder="Random secret for webhook verify" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Webhook URL</label>
            <Input value={s.webhookUrl||''} onChange={(e)=> setS({ ...s, webhookUrl: e.target.value })} placeholder="https://your-domain/api/wa-webhook" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Default Template</label>
            <Input value={s.defaultTemplate||''} onChange={(e)=> setS({ ...s, defaultTemplate: e.target.value })} placeholder="e.g. hello_world" />
          </div>
          <div className="md:col-span-2"><Button onClick={save}>Save</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Webhook</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Set your webhook to your serverless function URL and use the Verify Token above for the challenge. We can scaffold this next.</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppSettingsPage;
