import { useEffect, useState } from "react";
import { SupportStore, type SupportSettings } from "@/lib/supportStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SupportSettings = () => {
  const [s, setS] = useState<SupportSettings>(SupportStore.settings());
  const [newCat, setNewCat] = useState("");
  useEffect(()=> setS(SupportStore.settings()), []);
  const add = () => { if(!newCat.trim()) return; const next = { ...s, categories: Array.from(new Set([...(s.categories||[]), newCat.trim()])) }; setS(SupportStore.setSettings(next)); setNewCat(""); };
  const remove = (c: string) => { const next = { ...s, categories: (s.categories||[]).filter(x=> x!==c) }; setS(SupportStore.setSettings(next)); };
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-3xl font-bold mb-2">Support Settings</h1>
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
    </div>
  );
};

export default SupportSettings;
