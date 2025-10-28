import { useEffect, useMemo, useState } from "react";
import { EmailStore, type MailMessage } from "@/lib/emailStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const Inbox = () => {
  const [list, setList] = useState<MailMessage[]>(EmailStore.byFolder("inbox"));
  const [q, setQ] = useState("");
  const refresh = () => setList(EmailStore.byFolder("inbox"));
  useEffect(()=>{ refresh(); }, []);

  const filtered = useMemo(() => list.filter(m => {
    const hay = `${m.subject} ${m.body}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [list, q]);

  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Inbox</h1>
          <p className="text-sm text-muted-foreground">Your received emails</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search mail..." value={q} onChange={(e)=> setQ(e.target.value)} className="w-64" />
          <Button onClick={()=> navigate('/email/compose')}>Compose</Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-3 text-sm">FROM</th>
                <th className="text-left p-3 text-sm">SUBJECT</th>
                <th className="text-left p-3 text-sm">DATE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-t hover:bg-secondary/30 cursor-pointer" onClick={()=> navigate(`/email/${m.id}`)}>
                  <td className="p-3 text-sm">{m.from.name || m.from.email}</td>
                  <td className="p-3 text-sm">{m.subject}</td>
                  <td className="p-3 text-sm">{new Date(m.date).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length===0 && (<tr><td className="p-6 text-sm text-muted-foreground" colSpan={3}>No emails</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Inbox;
