/**
 * Which addresses open tickets.
 *
 * Mail arriving at an address with no route here lands in the shared inbox.
 * That is the deliberate default: an address nobody has configured must not
 * have its mail dropped, and a mailbox somebody has to read is a better failure
 * than silence.
 *
 * There is no limit on how many addresses can be listed — each is a row.
 */

import { useEffect, useState } from "react";
import { Plus, Trash, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { SupportStore } from "@/lib/supportStore";

type Route = {
  id: string;
  address: string;
  action: "ticket" | "inbox";
  category: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  active: boolean;
};

const PRIORITIES: Route["priority"][] = ["low", "medium", "high", "urgent"];

export const InboundRoutes = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState<string>("");
  const [priority, setPriority] = useState<Route["priority"]>("medium");
  const [busy, setBusy] = useState(false);

  const categories = SupportStore.settings().categories ?? [];

  const load = async () => {
    const { data, error } = await supabase
      .from("inbound_routes")
      .select("id, address, action, category, priority, active")
      .order("address");
    if (error) {
      toast({ title: "Could not load routing", description: error.message, variant: "destructive" });
      return;
    }
    setRoutes((data ?? []) as Route[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    const clean = address.trim().toLowerCase();
    if (!clean.includes("@")) {
      toast({ title: "That is not an address", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("inbound_routes").insert({
      address: clean,
      action: "ticket",
      category: category || null,
      priority,
    });
    setBusy(false);
    if (error) {
      toast({
        title: "Could not add it",
        // The unique constraint is the common case and worth saying plainly.
        description: error.message.includes("duplicate")
          ? `${clean} already has a route.`
          : error.message,
        variant: "destructive",
      });
      return;
    }
    setAddress("");
    setCategory("");
    await load();
    toast({ title: "Route added", description: `Mail to ${clean} will open a ticket.` });
  };

  const remove = async (route: Route) => {
    if (!window.confirm(`Stop opening tickets from ${route.address}? Its mail will go to the inbox instead.`)) {
      return;
    }
    const { error } = await supabase.from("inbound_routes").delete().eq("id", route.id);
    if (error) {
      toast({ title: "Could not remove it", description: error.message, variant: "destructive" });
      return;
    }
    await load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" aria-hidden="true" />
          Addresses that open tickets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Mail to these addresses becomes a support ticket, and the sender gets an acknowledgement with
          the ticket reference so their replies land on the same ticket. Anything arriving at an address
          not listed here goes to the shared inbox instead.
        </p>

        {routes.length > 0 && (
          <div className="divide-y rounded-md border">
            {routes.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm">{r.address}</div>
                  <div className="text-xs text-muted-foreground">
                    Opens a {r.priority} priority ticket
                    {r.category ? ` in ${r.category}` : ""}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-danger"
                  onClick={() => void remove(r)}
                  aria-label={`Remove ${r.address}`}
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <Input
            placeholder="support@yourcompany.co.za"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-label="Address"
          />
          <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
            <SelectTrigger aria-label="Category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as Route["priority"])}>
            <SelectTrigger aria-label="Priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void add()} disabled={busy || !address.trim()}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          The priority sets the ticket's SLA from the targets above. Receiving at an address also needs
          your mail provider to deliver it — see DEPLOYMENT.md step 13.
        </p>
      </CardContent>
    </Card>
  );
};
