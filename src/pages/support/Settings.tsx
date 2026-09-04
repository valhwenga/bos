import { useEffect, useState } from "react";
import { SupportStore, type SupportSettings } from "@/lib/supportStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useCache } from "@/lib/collectionCache";
import { supportSettingsCache } from "@/lib/supportStore";
import { InboundRoutes } from "@/components/InboundRoutes";

const SupportSettings = () => {
  // Settings are shared now, so this re-renders when they load or somebody
  // else changes them.
  useCache(supportSettingsCache);
  const [s, setS] = useState<SupportSettings>(SupportStore.settings());
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    void SupportStore.load().then(() => setS(SupportStore.settings()));
  }, []);

  const save = async (next: SupportSettings) => {
    try {
      await SupportStore.setSettings(next);
      setS(SupportStore.settings());
    } catch (err) {
      toast({
        title: "Could not save support settings",
        description: err instanceof Error ? err.message : "Nothing was changed.",
        variant: "destructive",
      });
    }
  };

  const add = () => {
    if (!newCat.trim()) return;
    void save({ ...s, categories: Array.from(new Set([...(s.categories || []), newCat.trim()])) });
    setNewCat("");
  };
  const remove = (c: string) => {
    void save({ ...s, categories: (s.categories || []).filter((x) => x !== c) });
  };
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Support Settings</h1>
        <div className="text-sm text-muted-foreground">Categories, priorities and basic SLA placeholders.</div>
      </div>

      <div className="rounded border p-4">
        <h4 className="font-semibold mb-3">Ticket Categories</h4>
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="New category" value={newCat} onChange={(e)=> setNewCat(e.target.value)} className="w-64" />
          <Button onClick={add}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(s.categories||[]).map(c => (
            <span key={c} className="inline-flex items-center gap-2 text-xs border rounded px-2 py-1">
              {c}
              <button className="text-destructive" onClick={()=> remove(c)}>&times;</button>
            </span>
          ))}
          {(s.categories||[]).length===0 && (
            <div className="text-sm text-muted-foreground">No categories yet.</div>
          )}
        </div>
      </div>

      <InboundRoutes />
    </div>
  );
};

export default SupportSettings;
