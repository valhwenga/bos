import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmLeadsStore } from "@/lib/crmLeadsStore";
import { CrmDealsStore } from "@/lib/crmDealsStore";

const Reports = () => {
  const leads = CrmLeadsStore.list();
  const deals = CrmDealsStore.list();
  const leadsByStage = leads.reduce<Record<string, number>>((m, l) => { m[l.stage] = (m[l.stage]||0)+1; return m; }, {});
  const dealsByStage = deals.reduce<Record<string, number>>((m, d) => { m[d.stage] = (m[d.stage]||0)+1; return m; }, {});
  const pipeline = deals.filter(d => !d.stage.startsWith('closed')).reduce((s,d)=> s+d.value, 0);

  return (
    <div className="p-6 grid md:grid-cols-3 gap-4">
      <Card>
        <CardHeader><CardTitle>Leads by Stage</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {Object.entries(leadsByStage).map(([k,v]) => (
            <div key={k} className="flex items-center justify-between text-sm"><span className="capitalize">{k.replace('_',' ')}</span><span>{v}</span></div>
          ))}
          {Object.keys(leadsByStage).length===0 && <div className="text-sm text-muted-foreground">No data</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Deals by Stage</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {Object.entries(dealsByStage).map(([k,v]) => (
            <div key={k} className="flex items-center justify-between text-sm"><span className="capitalize">{k.replace('_',' ')}</span><span>{v}</span></div>
          ))}
          {Object.keys(dealsByStage).length===0 && <div className="text-sm text-muted-foreground">No data</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Pipeline Total</CardTitle></CardHeader>
        <CardContent><div className="text-2xl font-semibold">${pipeline.toFixed(2)}</div></CardContent>
      </Card>
    </div>
  );
};

export default Reports;
