/**
 * The addresses the system may send as.
 *
 * Adding one here is what allows it to be used — the send function refuses any
 * address not on this list, because a caller that could name its own From
 * header could send as anybody from inside the company's own relay.
 *
 * Adding an address here does not make your mail server willing to send as it.
 * That is a DNS and provider matter, and getting it wrong means your mail is
 * delivered to spam or refused outright, so the panel says so.
 */

import { useEffect, useState } from "react";
import { Plus, Trash, Star, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useCache } from "@/lib/collectionCache";
import { SendIdentities, sendIdentitiesCache } from "@/lib/sendIdentities";
import { Modules, type ModuleKey } from "@/lib/modules";

const ANY_MODULE = "__any__";

export const SendIdentitiesPanel = () => {
  const { error } = useCache(sendIdentitiesCache);
  const identities = SendIdentities.list();

  const [address, setAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [module, setModule] = useState<string>(ANY_MODULE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void sendIdentitiesCache.ensureLoaded();
  }, []);

  const add = async () => {
    const clean = address.trim().toLowerCase();
    if (!clean.includes("@")) {
      toast({ title: "That is not an address", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await SendIdentities.upsert({
        address: clean,
        displayName: displayName.trim() || undefined,
        module: module === ANY_MODULE ? undefined : (module as ModuleKey),
        // The first one added becomes the default, since a list with no
        // default would silently fall back to SMTP_FROM and confuse anybody
        // who thought they had configured this.
        isDefault: identities.length === 0,
        active: true,
      });
      setAddress("");
      setDisplayName("");
      setModule(ANY_MODULE);
      toast({ title: "Address added", description: `The system may now send as ${clean}.` });
    } catch (err: unknown) {
      toast({
        title: "Could not add it",
        description:
          err instanceof Error && err.message.includes("duplicate")
            ? `${clean} is already listed.`
            : err instanceof Error
              ? err.message
              : "Nothing was saved.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, addr: string) => {
    if (!window.confirm(`Stop sending as ${addr}? Anything set to use it falls back to the default.`)) {
      return;
    }
    try {
      await SendIdentities.remove(id);
    } catch (err: unknown) {
      toast({
        title: "Could not remove it",
        description: err instanceof Error ? err.message : "Nothing was changed.",
        variant: "destructive",
      });
    }
  };

  const makeDefault = async (id: string) => {
    try {
      await SendIdentities.setDefault(id);
    } catch (err: unknown) {
      toast({
        title: "Could not set the default",
        description: err instanceof Error ? err.message : "Nothing was changed.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AtSign className="h-4 w-4" aria-hidden="true" />
          Addresses the system sends from
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A reply to a ticket goes out from the address the customer wrote to, and Compose lets you
          choose. With none listed, everything goes out from the single address configured on the
          server, which is how it worked before.
        </p>

        {error && (
          <div className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error.message}
          </div>
        )}

        {identities.length > 0 && (
          <div className="divide-y rounded-md border">
            {identities.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate font-mono text-sm">
                    {i.address}
                    {i.isDefault && (
                      <span className="rounded-sm bg-success-soft px-1.5 py-0.5 font-sans text-xs text-success">
                        default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i.displayName ? `Shown as "${i.displayName}"` : "No display name"}
                    {i.module ? ` • only with ${i.module} edit access` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {!i.isDefault && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => void makeDefault(i.id)}
                      aria-label={`Make ${i.address} the default`}
                      title="Make default"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-danger"
                    onClick={() => void remove(i.id, i.address)}
                    aria-label={`Remove ${i.address}`}
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-[2fr_1.5fr_1.2fr_auto]">
          <Input
            placeholder="support@yourcompany.co.za"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-label="Address"
          />
          <Input
            placeholder="Display name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-label="Display name"
          />
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger aria-label="Restrict to module">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_MODULE}>Anyone who can send</SelectItem>
              {Modules.map((m) => (
                <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void add()} disabled={busy || !address.trim()}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Restricting an address to a module means only somebody who can edit that module may send as
          it — so a support agent cannot write to a customer as accounts@ and ask them to change bank
          details.
        </p>

        <div className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">
          Listing an address here permits the system to use it. Your mail provider must also be willing
          to send as it, and the domain's SPF and DKIM records must cover it — otherwise the mail is
          delivered to spam or refused. Check with whoever manages the domain before adding an address
          on a domain you do not control.
        </div>
      </CardContent>
    </Card>
  );
};
