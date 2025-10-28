import { useMemo, useState } from "react";
import { DealCard } from "@/components/DealCard";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CRMStore, type Deal, type DealStage } from "@/lib/crmStore";

const stats = [
  {
    title: "Total Deals",
    value: "$1,404,250.99",
    icon: DollarSign,
    color: "bg-blue-500",
  },
  {
    title: "This Month Total Deals",
    value: "$0.00",
    icon: DollarSign,
    color: "bg-green-500",
  },
  {
    title: "This Week Total Deals",
    value: "$0.00",
    icon: DollarSign,
    color: "bg-orange-500",
  },
  {
    title: "Last 30 Days Total Deals",
    value: "$0.00",
    icon: DollarSign,
    color: "bg-pink-500",
  },
];
const CRMDeals = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [stage, setStage] = useState<DealStage>("Initial Contact");
  const stages = CRMStore.stages();
  const data = useMemo(() => stages.map((s) => ({ stage: s, deals: CRMStore.byStage(s) })), [stages, open, title, amount, stage]);

  const add = () => {
    if (!title.trim()) return;
    const d: Deal = { id: `d_${Date.now()}`, title, amount, stage, status: "New" };
    CRMStore.upsert(d);
    setTitle("");
    setAmount(0);
    setOpen(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage Deals - Sales</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>Deal</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Sales
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Sales</DropdownMenuItem>
              <DropdownMenuItem>Marketing</DropdownMenuItem>
              <DropdownMenuItem>Support</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="bg-primary" onClick={()=> setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Deal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {stats.map((stat, index) => (
          <Card key={index} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-full ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {data.map((column) => (
          <div key={column.stage} className="flex-shrink-0 w-80">
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{column.stage}</h3>
                <span className={`w-8 h-8 rounded-lg bg-secondary flex items-center justify-center font-semibold text-sm`}>
                  {column.deals.length}
                </span>
              </div>
              <div className="space-y-3 max-h[600px] overflow-y-auto">
                {column.deals.map((deal) => (
                  <DealCard key={deal.id} title={deal.title} status={(deal.status as any) || "New"} amount={`$${(deal.amount||0).toLocaleString()}`} progress="" tasks={0} comments={0} members={[]} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Deal</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Title</label>
            <Input value={title} onChange={(e)=> setTitle(e.target.value)} />
            <label className="text-xs text-muted-foreground mt-2">Amount</label>
            <Input type="number" value={amount} onChange={(e)=> setAmount(parseFloat(e.target.value||"0"))} />
            <label className="text-xs text-muted-foreground mt-2">Stage</label>
            <select className="h-10 rounded-md border bg-background px-3" value={stage} onChange={(e)=> setStage(e.target.value as DealStage)}>
              {stages.map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMDeals;
