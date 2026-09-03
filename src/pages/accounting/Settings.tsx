import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CompanySettingsStore, companySettingsCache } from "@/lib/companySettings";
import { useCache } from "@/lib/collectionCache";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

const Settings: React.FC = () => {
  // Settings are shared now, so this re-renders when they load or someone else
  // changes them.
  useCache(companySettingsCache);
  const [s, setS] = useState(CompanySettingsStore.get());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "signature" | null>(null);

  useEffect(() => {
    void CompanySettingsStore.load().then(() => setS(CompanySettingsStore.get()));
  }, []);

  // Uploaded straight to the company-assets bucket. These used to be resized on
  // a canvas and stored as base64 data URLs on the settings record, which meant
  // a logo counted against the localStorage quota and was set per machine.
  const uploadImage = async (kind: "logo" | "signature", file?: File) => {
    if (!file) return;
    setUploading(kind);
    try {
      await CompanySettingsStore.setImage(kind, file);
      setS(CompanySettingsStore.get());
      toast({ title: `${kind === "logo" ? "Logo" : "Signature"} updated` });
    } catch (err) {
      toast({
        title: `Could not upload the ${kind}`,
        description: err instanceof Error ? err.message : "It is unchanged.",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => void uploadImage("logo", e.target.files?.[0]);
  const onSignature = (e: React.ChangeEvent<HTMLInputElement>) => void uploadImage("signature", e.target.files?.[0]);

  const clearImage = async (kind: "logo" | "signature") => {
    try {
      await CompanySettingsStore.clearImage(kind);
      setS(CompanySettingsStore.get());
    } catch (err) {
      toast({
        title: `Could not remove the ${kind}`,
        description: err instanceof Error ? err.message : "It is unchanged.",
        variant: "destructive",
      });
    }
  };

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      await CompanySettingsStore.set(s);
      toast({ title: "Settings saved", description: "Everyone sees these on their documents." });
    } catch (err) {
      // These are shared now, so a failure means nobody's documents changed —
      // which is worth saying rather than showing a success toast.
      toast({
        title: "Could not save settings",
        description: err instanceof Error ? err.message : "Nothing was changed.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
              <Input value={s?.name || ""} onChange={(e)=> setS({ ...s, name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Tax ID</label>
              <Input value={s?.taxId || ""} onChange={(e)=> setS({ ...s, taxId: e.target.value })} />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Address</label>
              <Input value={s?.address || ""} onChange={(e)=> setS({ ...s, address: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={s?.email || ""} onChange={(e)=> setS({ ...s, email: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input value={s?.phone || ""} onChange={(e)=> setS({ ...s, phone: e.target.value })} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Currency Code</label>
              <Input value={s?.currencyCode || ""} onChange={(e)=> setS({ ...s, currencyCode: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Currency Symbol</label>
              <Input value={s?.currencySymbol || ""} onChange={(e)=> setS({ ...s, currencySymbol: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Primary Color</label>
              <Input type="color" value={s?.primaryColor || "#128768"} onChange={(e)=> setS({ ...s, primaryColor: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Secondary Color</label>
              <Input type="color" value={s?.secondaryColor || "#1BA37E"} onChange={(e)=> setS({ ...s, secondaryColor: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Logo</label>
              <Input type="file" accept="image/*" onChange={onLogo} disabled={uploading === "logo"} />
            </div>
          </div>
          {s?.logoDataUrl && (
            <div className="flex items-center gap-4">
              <img src={s?.logoDataUrl} alt="Logo preview" className="h-12 w-auto border-0 bg-transparent" />
              <Button variant="secondary" onClick={() => void clearImage("logo")}>Remove Logo</Button>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-1 md:col-span-1">
              <label className="text-xs text-muted-foreground">Signature Image</label>
              <Input type="file" accept="image/*" onChange={onSignature} disabled={uploading === "signature"} />
            </div>
          </div>
          {s?.signatureDataUrl && (
            <div className="flex items-center gap-4">
              <img src={s.signatureDataUrl} alt="Signature preview" className="h-16 w-auto rounded border bg-white p-1" />
              <Button variant="secondary" onClick={() => void clearImage("signature")}>Remove Signature</Button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Bank Name</label>
              <Input value={s?.bankName || ""} onChange={(e)=> setS({ ...s, bankName: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Account Number</label>
              <Input value={s?.bankAccount || ""} onChange={(e)=> setS({ ...s, bankAccount: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Branch Code</label>
              <Input value={s?.branchCode || ""} onChange={(e)=> setS({ ...s, branchCode: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Branch Name</label>
              <Input value={s?.branchName || ""} onChange={(e)=> setS({ ...s, branchName: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">SWIFT</label>
              <Input value={s?.bankSwift || ""} onChange={(e)=> setS({ ...s, bankSwift: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">IBAN</label>
              <Input value={s?.bankIban || ""} onChange={(e)=> setS({ ...s, bankIban: e.target.value })} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Default Customer Notes</label>
              <Input value={s?.customerNotesDefault || ""} onChange={(e)=> setS({ ...s, customerNotesDefault: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Footer Note</label>
              <Input value={s?.footerNote || ""} onChange={(e)=> setS({ ...s, footerNote: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void save()}>Save Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
