import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, CircleDollarSign, Plus, Target, Trophy } from "lucide-react";
import { CrmDealsStore, type Deal, type DealStage } from "@/lib/crmDealsStore";
import { CrmCustomersStore } from "@/lib/crmCustomersStore";
import { UsersStore } from "@/lib/usersStore";
import { CompanySettingsStore } from "@/lib/companySettings";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

/** Column accent conveys outcome: open stages neutral, won/lost decisive. */
const STAGES: { key: DealStage; title: string; tone: string }[] = [
  { key: "negotiation", title: "Negotiation", tone: "bg-info" },
  { key: "proposal", title: "Proposal", tone: "bg-info" },
  { key: "review", title: "Review", tone: "bg-warning" },
  { key: "closed_won", title: "Won", tone: "bg-success" },
  { key: "closed_lost", title: "Lost", tone: "bg-danger" },
];

const CLOSED: DealStage[] = ["closed_won", "closed_lost"];

const DealsBoard = () => {
  const [deals, setDeals] = useState(CrmDealsStore.list());
  const [dragOver, setDragOver] = useState<DealStage | null>(null);
  const navigate = useNavigate();
  const users = UsersStore.list();
  const customers = CrmCustomersStore.list();
  const currency = CompanySettingsStore.get().currencySymbol || "$";

  // A ref, not a plain `let` in the render body — that was reset on every
  // render, so click-versus-drag detection was unreliable.
  const dragOrigin = useRef<{ id?: string; x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const refresh = () => setDeals(CrmDealsStore.list());
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const grouped = useMemo(() => {
    const map: Record<DealStage, Deal[]> = {
      negotiation: [], proposal: [], review: [], closed_won: [], closed_lost: [],
    };
    for (const d of deals) (map[d.stage] ?? map.negotiation).push(d);
    return map;
  }, [deals]);

  const openDeals = deals.filter((d) => !CLOSED.includes(d.stage));
  const pipeline = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  // Weighted by each deal's own probability — the number worth forecasting on.
  const weighted = openDeals.reduce((sum, d) => sum + (d.value || 0) * ((d.probability || 0) / 100), 0);
  const won = grouped.closed_won.reduce((sum, d) => sum + (d.value || 0), 0);

  const money = (v: number) =>
    `${currency}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const add = () => {
    const deal: Deal = {
      id: `D_${Date.now()}`,
      title: "New deal",
      stage: "negotiation",
      value: 0,
      probability: 10,
      createdAt: new Date().toISOString(),
    };
    CrmDealsStore.upsert(deal);
    setDeals(CrmDealsStore.list());
    navigate(`/crm/deals/${deal.id}`);
  };

  const moveTo = (dealId: string, stage: DealStage) => {
    CrmDealsStore.move(dealId, stage);
    setDeals(CrmDealsStore.list());
  };

  const columnTotal = (stage: DealStage) =>
    grouped[stage].reduce((sum, d) => sum + (d.value || 0), 0);

  const isOverdue = (d: Deal) =>
    !CLOSED.includes(d.stage) && !!d.expectedClose && new Date(d.expectedClose).getTime() < Date.now();

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Deals"
        description="Your pipeline by stage. Drag a card to move it."
        breadcrumbs={[{ label: "CRM", to: "/crm/leads" }, { label: "Deals" }]}
        actions={
          <Button onClick={add}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New deal
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open deals" value={openDeals.length} hint="Not yet closed" icon={Target} />
          <StatCard label="Pipeline" value={money(pipeline)} hint="Total open value" icon={CircleDollarSign} tone="info" />
          <StatCard label="Weighted" value={money(weighted)} hint="Adjusted for probability" icon={Target} />
          <StatCard label="Won" value={money(won)} hint={`${grouped.closed_won.length} closed won`} icon={Trophy} tone="success" />
        </div>
      </PageHeader>

      <div className="scrollbar-subtle -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {STAGES.map((col) => {
          const cards = grouped[col.key];
          return (
            <section
              key={col.key}
              aria-label={col.title}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver((s) => (s === col.key ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                try {
                  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                  if (data?.id) moveTo(data.id, col.key);
                } catch { /* not a card payload */ }
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-md border bg-surface-raised transition-colors duration-fast ease-standard",
                dragOver === col.key ? "border-primary bg-primary-soft" : "border-border",
              )}
            >
              <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", col.tone)} aria-hidden="true" />
                <h2 className="text-sm font-medium text-foreground">{col.title}</h2>
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {cards.length}
                </span>
                <span className="tabular ml-auto text-xs text-muted-foreground">{money(columnTotal(col.key))}</span>
              </header>

              <div className="flex flex-1 flex-col gap-2 p-2">
                {cards.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-subtle">Nothing here</p>
                ) : (
                  cards.map((d) => {
                    const owner = users.find((u) => u.id === d.ownerId);
                    const customer = customers.find((c) => c.id === d.customerId);
                    return (
                      <article
                        key={d.id}
                        draggable
                        onPointerDown={(e) => { dragOrigin.current = { id: d.id, x: e.clientX, y: e.clientY }; }}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ id: d.id }))}
                        onClick={(e) => {
                          // Only navigate on a real click, not the tail of a drag.
                          const moved =
                            Math.abs(dragOrigin.current.x - e.clientX) > 4 ||
                            Math.abs(dragOrigin.current.y - e.clientY) > 4;
                          if (!moved) navigate(`/crm/deals/${d.id}`);
                        }}
                        className="flex cursor-pointer select-none flex-col gap-2 rounded-md border border-border bg-card p-3 shadow-xs transition-shadow duration-fast ease-standard hover:border-border-strong hover:shadow-sm"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium leading-snug text-foreground">{d.title}</span>
                          {customer && <span className="truncate text-xs text-muted-foreground">{customer.name}</span>}
                        </div>

                        <div className="flex items-baseline justify-between gap-2">
                          <span className="tabular text-sm font-semibold text-foreground">{money(d.value || 0)}</span>
                          <span className="text-xs text-muted-foreground">{d.probability || 0}%</span>
                        </div>

                        {/* Probability as a bar reads faster than a number alone. */}
                        <div className="h-1 overflow-hidden rounded-full bg-muted" role="presentation">
                          <div
                            className={cn("h-full rounded-full", col.key === "closed_lost" ? "bg-danger" : "bg-primary")}
                            style={{ width: `${Math.min(100, Math.max(0, d.probability || 0))}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          {d.expectedClose ? (
                            <span className={cn("inline-flex items-center gap-1 text-xs", isOverdue(d) ? "font-medium text-danger" : "text-muted-foreground")}>
                              <CalendarClock className="h-3 w-3" aria-hidden="true" />
                              {new Date(d.expectedClose).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-xs text-subtle">No close date</span>
                          )}
                          {owner && (
                            <span
                              title={owner.name}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-medium text-primary-foreground"
                            >
                              {owner.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default DealsBoard;
