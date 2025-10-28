export type DealStage = "Initial Contact" | "Qualification" | "Meeting" | "Proposal" | "Close";
export type Deal = {
  id: string;
  title: string;
  amount?: number;
  stage: DealStage;
  status?: string;
};

const K = { deals: "crm.deals" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Deal[] = [
  { id: "d1", title: "Project Accelerator", amount: 150000, stage: "Initial Contact", status: "On Hold" },
  { id: "d2", title: "Stella", amount: 0, stage: "Qualification", status: "New" },
  { id: "d3", title: "Donovan Olsen", amount: 1500, stage: "Meeting", status: "New" },
  { id: "d4", title: "Solution Customization", amount: 35000, stage: "Proposal", status: "On Hold" },
];

export const CRMStore = {
  list(): Deal[] { return r<Deal[]>(K.deals, SEED); },
  upsert(d: Deal) { const all = this.list(); const i = all.findIndex(x=>x.id===d.id); if(i>=0) all[i]=d; else all.push(d); w(K.deals, all); return d; },
  remove(id: string) { const all = this.list().filter(x=> x.id !== id); w(K.deals, all); },
  byStage(stage: DealStage): Deal[] { return this.list().filter(d=> d.stage === stage); },
  stages(): DealStage[] { return ["Initial Contact","Qualification","Meeting","Proposal","Close"]; },
};
