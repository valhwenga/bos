import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompanySettingsStore, type CompanySettings } from "@/lib/companySettings";
import { toast } from "@/components/ui/use-toast";

const Settings: React.FC = () => {
  const [s, setS] = useState<CompanySettings>(CompanySettingsStore.get());

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const img = new Image();
        img.onload = () => {
          const MAX = 512; // max dimension
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            setS({ ...s, logoDataUrl: dataUrl });
          } else {
            setS({ ...s, logoDataUrl: String(reader.result) });
          }
        };
        img.src = String(reader.result);
      } catch (err) {
        setS({ ...s, logoDataUrl: String(reader.result) });
      }
    };
    reader.readAsDataURL(f);
  };

  const onSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const img = new Image();
        img.onload = () => {
          const MAX_W = 320; const MAX_H = 160; // keep signature small
          const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/png", 0.9);
            setS({ ...s, signatureDataUrl: dataUrl });
          } else {
            setS({ ...s, signatureDataUrl: String(reader.result) });
          }
        };
        img.src = String(reader.result);
      } catch (err) {
        setS({ ...s, signatureDataUrl: String(reader.result) });
      }
    };
    reader.readAsDataURL(f);
  };
  const save = () => {
    try {
      CompanySettingsStore.set(s);
      window.dispatchEvent(new Event("company-settings-changed"));
      toast({ title: "Settings saved" });
    } catch (err) {
      toast({ title: "Failed to save", description: "Try a smaller logo image or reduce size.", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader>
          <CardTitle>Company Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Company Name</label>
              <Input value={s.name} onChange={(e)=> setS({ ...s, name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Tax ID</label>
              <Input value={s.taxId || ""} onChange={(e)=> setS({ ...s, taxId: e.target.value })} />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Address</label>
              <Input value={s.address || ""} onChange={(e)=> setS({ ...s, address: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={s.email || ""} onChange={(e)=> setS({ ...s, email: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input value={s.phone || ""} onChange={(e)=> setS({ ...s, phone: e.target.value })} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Currency Code</label>
              <Input value={s.currencyCode} onChange={(e)=> setS({ ...s, currencyCode: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Currency Symbol</label>
              <Input value={s.currencySymbol} onChange={(e)=> setS({ ...s, currencySymbol: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Logo</label>
              <Input type="file" accept="image/*" onChange={onLogo} />
            </div>
          </div>
          {s.logoDataUrl && (
            <div className="flex items-center gap-4">
              <img src={s.logoDataUrl} alt="Logo preview" className="h-12 w-auto rounded border" />
              <Button variant="secondary" onClick={()=> setS({ ...s, logoDataUrl: undefined })}>Remove Logo</Button>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-1 md:col-span-1">
              <label className="text-xs text-muted-foreground">Signature Image</label>
              <Input type="file" accept="image/*" onChange={onSignature} />
            </div>
          </div>
          {s.signatureDataUrl && (
            <div className="flex items-center gap-4">
              <img src={s.signatureDataUrl} alt="Signature preview" className="h-16 w-auto rounded border bg-white p-1" />
              <Button variant="secondary" onClick={()=> setS({ ...s, signatureDataUrl: undefined })}>Remove Signature</Button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Bank Name</label>
              <Input value={s.bankName || ""} onChange={(e)=> setS({ ...s, bankName: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Account Number</label>
              <Input value={s.bankAccount || ""} onChange={(e)=> setS({ ...s, bankAccount: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Branch Code</label>
              <Input value={s.branchCode || ""} onChange={(e)=> setS({ ...s, branchCode: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Branch Name</label>
              <Input value={s.branchName || ""} onChange={(e)=> setS({ ...s, branchName: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">SWIFT</label>
              <Input value={s.bankSwift || ""} onChange={(e)=> setS({ ...s, bankSwift: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">IBAN</label>
              <Input value={s.bankIban || ""} onChange={(e)=> setS({ ...s, bankIban: e.target.value })} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Default Customer Notes</label>
              <Input value={s.customerNotesDefault || ""} onChange={(e)=> setS({ ...s, customerNotesDefault: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Footer Note</label>
              <Input value={s.footerNote || ""} onChange={(e)=> setS({ ...s, footerNote: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save}>Save Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
