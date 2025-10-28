import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountingStore, Invoice, Quotation, type Customer as AcctCustomer } from "@/lib/accountingStore";
import { PaymentStore, type Payment } from "@/lib/paymentStore";
import { SalesStore } from "@/lib/salesStore";
import { CreditNotesStore } from "@/lib/creditNotesStore";
import { ExpenseStore } from "@/lib/expenseStore";
import { CompanySettingsStore } from "@/lib/companySettings";

type ModuleKey = "quotations" | "invoices" | "payments" | "income" | "expenses" | "income_vs_expense";

const Reports: React.FC = () => {
  const cs = CompanySettingsStore.get();
  const [module, setModule] = useState<ModuleKey>("income");
  const [from, setFrom] = useState<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0,10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0,10));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onPayments = () => setTick(t=>t+1);
    const onStorage = (e: StorageEvent) => { if (!e.key) return; if (e.key.startsWith("acct.")) setTick(t=>t+1); };
    window.addEventListener('payments-changed', onPayments as any);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('payments-changed', onPayments as any); window.removeEventListener('storage', onStorage); };
  }, []);

  const range = useMemo(() => ({ from: new Date(from + 'T00:00:00'), to: new Date(to + 'T23:59:59') }), [from, to]);

  const data = useMemo(() => {
    if (module === "invoices") {
      const list = AccountingStore.listInvoices().filter(i => {
        const d = new Date(i.createdAt);
        return d >= range.from && d <= range.to;
      });
      const totals = list.reduce((acc, i) => {
        const sub = i.items.reduce((s,it)=> s + it.qty*it.price, 0);
        const paid = PaymentStore.sumAmount(PaymentStore.byInvoice(i.id));
        acc.count += 1; acc.total += sub; acc.paid += paid; acc.balance += Math.max(0, sub - paid); return acc;
      }, { count: 0, total: 0, paid: 0, balance: 0 });
      return { list, totals } as { list: Invoice[]; totals: { count:number; total:number; paid:number; balance:number } };
    } else if (module === "quotations") {
      const list = AccountingStore.listQuotes().filter(q => {
        const d = new Date(q.createdAt);
        return d >= range.from && d <= range.to;
      });
      const totals = list.reduce((acc, q) => {
        const sub = q.items.reduce((s,it)=> s + it.qty*it.price, 0);
        const discount = q.discountPct ? (sub * q.discountPct)/100 : 0;
        const shipping = q.shipping || 0;
        const grand = Math.max(0, sub - discount + shipping);
        const paid = PaymentStore.sumAmount(PaymentStore.byQuote(q.id));
        acc.count += 1; acc.total += grand; acc.paid += paid; acc.balance += Math.max(0, grand - paid); return acc;
      }, { count: 0, total: 0, paid: 0, balance: 0 });
      return { list, totals } as { list: Quotation[]; totals: { count:number; total:number; paid:number; balance:number } };
    } else if (module === "payments") {
      const list = PaymentStore.list().filter(p => {
        const d = new Date(p.date);
        return d >= range.from && d <= range.to;
      });
      const totals = list.reduce((acc, p) => { acc.count += 1; acc.amount += (p.amount||0); return acc; }, { count: 0, amount: 0 });
      return { list, totals } as { list: Payment[]; totals: { count:number; amount:number } };
    } else if (module === "income") {
      // Accrual: invoices by createdAt + sales by date - credit notes by date
      const invs = AccountingStore.listInvoices().filter(i=> {
        const d = new Date(i.createdAt); return d >= range.from && d <= range.to;
      });
      const invTotal = invs.reduce((s,i)=> s + i.items.reduce((ss,it)=> ss+it.qty*it.price, 0), 0);
      const sales = SalesStore.list().filter(s=> { const d = new Date(s.date); return d>=range.from && d<=range.to; });
      const salesTotal = sales.reduce((s,si)=> s + si.items.reduce((ss,it)=> ss+it.qty*it.price, 0), 0);
      const credits = CreditNotesStore.list().filter(cn=> { const d = new Date(cn.date); return d>=range.from && d<=range.to; });
      const creditsTotal = credits.reduce((s,cn)=> s + (cn.amount||0), 0);
      const cashReceived = PaymentStore.list().filter(p=> { const d = new Date(p.date); return d>=range.from && d<=range.to; }).reduce((s,p)=> s+(p.amount||0), 0);
      const gross = invTotal + salesTotal;
      const net = Math.max(0, gross - creditsTotal);
      return { invs, sales, credits, totals: { invTotal, salesTotal, creditsTotal, gross, net, cashReceived } } as any;
    } else if (module === "expenses") {
      const ex = ExpenseStore.list().filter(e=> { const d = new Date(e.date); return d>=range.from && d<=range.to; });
      const total = ex.reduce((s,e)=> s + (e.amount||0) + (e.tax||0), 0);
      return { ex, totals: { total, count: ex.length } } as any;
    } else if (module === "income_vs_expense") {
      // reuse computations
      const invs = AccountingStore.listInvoices().filter(i=> { const d = new Date(i.createdAt); return d>=range.from && d<=range.to; });
      const invTotal = invs.reduce((s,i)=> s + i.items.reduce((ss,it)=> ss+it.qty*it.price, 0), 0);
      const sales = SalesStore.list().filter(s=> { const d = new Date(s.date); return d>=range.from && d<=range.to; });
      const salesTotal = sales.reduce((s,si)=> s + si.items.reduce((ss,it)=> ss+it.qty*it.price, 0), 0);
      const creditsTotal = CreditNotesStore.list().filter(cn=> { const d = new Date(cn.date); return d>=range.from && d<=range.to; }).reduce((s,cn)=> s + (cn.amount||0), 0);
      const income = Math.max(0, invTotal + salesTotal - creditsTotal);
      const ex = ExpenseStore.list().filter(e=> { const d = new Date(e.date); return d>=range.from && d<=range.to; });
      const expenses = ex.reduce((s,e)=> s + (e.amount||0) + (e.tax||0), 0);
      const net = income - expenses;
      const cashReceived = PaymentStore.list().filter(p=> { const d = new Date(p.date); return d>=range.from && d<=range.to; }).reduce((s,p)=> s+(p.amount||0), 0);
      return { totals: { income, expenses, net, cashReceived } } as any;
    }
  }, [module, from, to, tick]);

  const allCustomers = useMemo(() => {
    const invCusts = AccountingStore.listInvoices().map(i=> i.customer);
    const qCusts = AccountingStore.listQuotes().map(q=> q.customer);
    const merged = [...invCusts, ...qCusts];
    return merged.reduce((acc, cur) => acc.find(c=> c.id===cur.id) ? acc : acc.concat(cur), [] as AcctCustomer[]);
  }, [tick]);

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Reports</CardTitle>
          <div className="flex items-center gap-2">
            <select className="border rounded px-2 py-2 text-sm bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100" value={module} onChange={(e)=> setModule(e.target.value as ModuleKey)}>
              <option value="income">Income (Accrual)</option>
              <option value="expenses">Expenses</option>
              <option value="income_vs_expense">Income vs Expense</option>
              <option value="invoices">Invoices</option>
              <option value="quotations">Quotations</option>
              <option value="payments">Payments (Cash)</option>
            </select>
            <Input type="date" value={from} onChange={(e)=> setFrom(e.target.value)} />
            <span>to</span>
            <Input type="date" value={to} onChange={(e)=> setTo(e.target.value)} />
            <Button variant="outline" onClick={()=> { setFrom(new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10)); setTo(new Date().toISOString().slice(0,10)); }}>This Year</Button>
            <Button variant="secondary" onClick={async ()=> {
              // Export CSV
              const esc = (s: any) => ('"' + String(s??'').replace(/"/g,'""') + '"');
              let rows: string[] = [];
              if (module === 'income') {
                rows.push(['Type','Date','Amount'].join(','));
                (data as any).invs.forEach((i: any)=> rows.push(['Invoice '+i.number, new Date(i.createdAt).toLocaleDateString(), i.items.reduce((s:any,it:any)=> s+it.qty*it.price,0).toFixed(2)].map(esc).join(',')));
                (data as any).sales.forEach((s: any)=> rows.push(['Sale '+s.number, new Date(s.date).toLocaleDateString(), s.items.reduce((su:number,it:any)=> su+it.qty*it.price,0).toFixed(2)].map(esc).join(',')));
                (data as any).credits.forEach((c: any)=> rows.push(['Credit '+c.number, new Date(c.date).toLocaleDateString(), (-c.amount||0).toFixed(2)].map(esc).join(',')));
              } else if (module === 'expenses') {
                rows.push(['Date','Vendor','Category','Amount'].join(','));
                (data as any).ex.forEach((e: any)=> rows.push([new Date(e.date).toLocaleDateString(), e.vendor, e.category, (((e.amount||0)+(e.tax||0)).toFixed(2))].map(esc).join(',')));
              } else if (module === 'income_vs_expense') {
                rows.push(['Metric','Amount'].join(','));
                const t = (data as any).totals; rows.push(['Income', t.income.toFixed(2)].map(esc).join(',')); rows.push(['Expenses', t.expenses.toFixed(2)].map(esc).join(',')); rows.push(['Net', t.net.toFixed(2)].map(esc).join(',')); rows.push(['Cash Received', t.cashReceived.toFixed(2)].map(esc).join(','));
              } else if (module === 'invoices') {
                rows.push(['No.','Customer','Date','Total','Paid','Balance'].join(','));
                (data as any).list.forEach((i: any)=> { const sub=i.items.reduce((s:any,it:any)=>s+it.qty*it.price,0); const paid=PaymentStore.sumAmount(PaymentStore.byInvoice(i.id)); rows.push([i.number, i.customer.name, new Date(i.createdAt).toLocaleDateString(), sub.toFixed(2), paid.toFixed(2), Math.max(0, sub-paid).toFixed(2)].map(esc).join(',')); });
              } else if (module === 'quotations') {
                rows.push(['No.','Customer','Date','Estimate','Deposits','Balance'].join(','));
                (data as any).list.forEach((q: any)=> { const sub=q.items.reduce((s:any,it:any)=>s+it.qty*it.price,0); const discount=q.discountPct?(sub*q.discountPct)/100:0; const shipping=q.shipping||0; const grand=Math.max(0,sub-discount+shipping); const paid=PaymentStore.sumAmount(PaymentStore.byQuote(q.id)); rows.push([q.number,q.customer.name,new Date(q.createdAt).toLocaleDateString(),grand.toFixed(2),paid.toFixed(2),Math.max(0,grand-paid).toFixed(2)].map(esc).join(',')); });
              } else if (module === 'payments') {
                rows.push(['Date','Customer','Applied To','Method','Reference','Amount'].join(','));
                (data as any).list.forEach((p: any)=> rows.push([new Date(p.date).toLocaleDateString(), ((allCustomers.find(c=> c.id===p.customerId)?.name) || p.customerId), (p.invoiceId?`Invoice ${p.invoiceId}`:(p.quoteId?`Quote ${p.quoteId}`:'Unapplied')), (p.method||''), (p.reference||''), (p.amount||0).toFixed(2)].map(esc).join(',')));
              }
              const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `report_${module}_${from}_to_${to}.csv`; a.click(); URL.revokeObjectURL(url);
            }}>Export CSV</Button>
            <Button onClick={async ()=> {
              // Export PDF with company styling similar to invoice/quote
              const cs2 = CompanySettingsStore.get();
              const ensureScript = (src: string) => new Promise<void>((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load '+src)); document.head.appendChild(s); });
              const w: any = window as any;
              if (!(w.jspdf || w.jspdf_esm || w.jspdfjs)) { try { await ensureScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'); } catch {} }
              const { jsPDF } = (w.jspdf || w.jspdf_esm || w.jspdfjs) as any;
              const pdf = new jsPDF('p','mm','a4');
              // Smooth gradient-like header (multi-band interpolation to simulate)
              const topColor = { r:95, g:51, b:255 };
              const bottomColor = { r:122, g:96, b:217 };
              const headerH = 22; const steps = 22; // 1mm bands
              for (let i=0; i<steps; i++) {
                const t = i/(steps-1);
                const r = Math.round(topColor.r + (bottomColor.r - topColor.r) * t);
                const g = Math.round(topColor.g + (bottomColor.g - topColor.g) * t);
                const b = Math.round(topColor.b + (bottomColor.b - topColor.b) * t);
                pdf.setFillColor(r,g,b);
                pdf.rect(0, i*(headerH/steps), 210, (headerH/steps)+0.2, 'F');
              }
              // Header content (logo left, details right)
              if (cs2.logoDataUrl) { try { pdf.addImage(cs2.logoDataUrl, 'PNG', 12, 5, 28, 12); } catch {} }
              pdf.setTextColor(255,255,255);
              pdf.setFontSize(12); pdf.text(cs2.name || 'Company', 198, 8, { align: 'right' as any });
              // Single-line address beneath company name
              if (cs2.address) {
                const addrLine = String(cs2.address).split(/\r?\n/)[0]?.slice(0, 60) || '';
                if (addrLine) { pdf.setFontSize(8); pdf.text(addrLine, 198, 11, { align: 'right' as any }); }
              }
              // Contact line beneath address
              pdf.setFontSize(9); const hdr2 = `${cs2.email||''}${cs2.email&&cs2.phone?' • ':''}${cs2.phone||''}`;
              if (hdr2.trim()) pdf.text(hdr2, 198, 15, { align: 'right' as any });
              // Report title area directly below header (company details remain in header only)
              let y = 28; pdf.setTextColor(0,0,0);
              const titleMap: Record<string,string> = { income: 'Income (Accrual)', expenses: 'Expenses', income_vs_expense: 'Income vs Expense', invoices: 'Invoices', quotations: 'Quotations', payments: 'Payments (Cash)' } as any;
              pdf.setFontSize(16); pdf.text(titleMap[module], 12, y); pdf.setFontSize(10);
              const period = `${new Date(from).toLocaleDateString()} - ${new Date(to).toLocaleDateString()}`;
              pdf.text(period, 198, y, { align: 'right' as any });
              y += 6;
              // Consolidated summary chips/boxes
              const drawChip = (label: string, value: string, x: number) => {
                pdf.setDrawColor(220,220,225); pdf.setFillColor(247,247,250);
                pdf.roundedRect(x, y, 60, 12, 2, 2, 'FD');
                pdf.setTextColor(102,102,110); pdf.setFontSize(8); pdf.text(label, x+4, y+5);
                pdf.setTextColor(33,33,36); pdf.setFontSize(11); pdf.text(value, x+4, y+10);
              };
              if (module==='income') {
                const t = (data as any).totals; drawChip('Invoices', `${cs.currencySymbol}${(t.invTotal||0).toFixed(2)}`, 12); drawChip('Sales', `${cs.currencySymbol}${(t.salesTotal||0).toFixed(2)}`, 76); drawChip('Credits', `-${cs.currencySymbol}${(t.creditsTotal||0).toFixed(2)}`, 140);
                y += 16; drawChip('Gross', `${cs.currencySymbol}${(t.gross||0).toFixed(2)}`, 12); drawChip('Net', `${cs.currencySymbol}${(t.net||0).toFixed(2)}`, 76); drawChip('Cash Received', `${cs.currencySymbol}${(t.cashReceived||0).toFixed(2)}`, 140); y += 18;
              } else if (module==='expenses') {
                const t = (data as any).totals; drawChip('Count', String(t.count||0), 12); drawChip('Total', `${cs.currencySymbol}${(t.total||0).toFixed(2)}`, 76); y += 18;
                // Expenses by Category summary table
                pdf.setFontSize(12); pdf.text('By Category', 12, y); y += 6; pdf.setFontSize(10);
                const catTotals: Record<string, number> = {};
                (data as any).ex.forEach((e: any) => { const amt = (e.amount||0) + (e.tax||0); catTotals[e.category||'Uncategorized'] = (catTotals[e.category||'Uncategorized']||0) + amt; });
                const entries = Object.entries(catTotals).sort((a,b)=> b[1]-a[1]);
                // header
                pdf.setTextColor(102,102,110); pdf.text('Category', 12, y); pdf.text('Amount', 180, y, { align: 'right' as any }); y += 4; pdf.setDrawColor(235,235,240); pdf.line(12, y, 198, y); y += 3; pdf.setTextColor(33,33,36);
                entries.forEach(([cat, amt]) => { pdf.text(String(cat), 12, y); pdf.text(`${cs.currencySymbol}${amt.toFixed(2)}`, 180, y, { align: 'right' as any }); y += 6; if (y>280) { pdf.addPage(); y=20; } });
                y += 4;
              } else if (module==='income_vs_expense') {
                const t = (data as any).totals; drawChip('Income', `${cs.currencySymbol}${(t.income||0).toFixed(2)}`, 12); drawChip('Expenses', `${cs.currencySymbol}${(t.expenses||0).toFixed(2)}`, 76); drawChip('Net', `${cs.currencySymbol}${(t.net||0).toFixed(2)}`, 140); y += 18; drawChip('Cash Received', `${cs.currencySymbol}${(t.cashReceived||0).toFixed(2)}`, 12); y += 18;
              } else {
                // For detailed modules, provide period only
                y += 4;
              }
              // Table header divider
              pdf.setDrawColor(230,230,235); pdf.line(12, y, 198, y); y+=4; pdf.setFontSize(10);
              const col = (x: number, txt: string) => pdf.text(txt, x, y);
              const row = () => { y+=6; if (y>280) { pdf.addPage(); y=20; } };
              if (module==='income') {
                col(12,'Type'); col(80,'Date'); col(160,'Amount'); row();
                (data as any).invs.forEach((i:any)=> { col(12,`Invoice ${i.number}`); col(80,new Date(i.createdAt).toLocaleDateString()); col(160,(i.items.reduce((s:any,it:any)=>s+it.qty*it.price,0)).toFixed(2)); row(); });
                (data as any).sales.forEach((s:any)=> { col(12,`Sale ${s.number}`); col(80,new Date(s.date).toLocaleDateString()); col(160,(s.items.reduce((su:number,it:any)=>su+it.qty*it.price,0)).toFixed(2)); row(); });
                (data as any).credits.forEach((c:any)=> { col(12,`Credit ${c.number}`); col(80,new Date(c.date).toLocaleDateString()); col(160,`-${(c.amount||0).toFixed(2)}`); row(); });
              } else if (module==='expenses') {
                col(12,'Date'); col(60,'Vendor'); col(120,'Category'); col(170,'Amount'); row();
                (data as any).ex.forEach((e:any)=> { col(12,new Date(e.date).toLocaleDateString()); col(60,String(e.vendor)); col(120,String(e.category)); col(170,(((e.amount||0)+(e.tax||0)).toFixed(2))); row(); });
              } else if (module==='income_vs_expense') {
                col(12,'Metric'); col(140,'Amount'); row(); const t=(data as any).totals; [['Income',t.income],['Expenses',t.expenses],['Net',t.net],['Cash Received',t.cashReceived]].forEach(([k,v]:any)=> { col(12,String(k)); col(140,(Number(v)||0).toFixed(2)); row(); });
              } else if (module==='invoices') {
                col(12,'No.'); col(60,'Customer'); col(120,'Date'); col(155,'Total'); col(180,'Balance'); row();
                (data as any).list.forEach((i:any)=> { const sub=i.items.reduce((s:any,it:any)=>s+it.qty*it.price,0); const bal=Math.max(0, sub - PaymentStore.sumAmount(PaymentStore.byInvoice(i.id))); col(12,i.number); col(60,i.customer.name); col(120,new Date(i.createdAt).toLocaleDateString()); col(155,sub.toFixed(2)); col(180,bal.toFixed(2)); row(); });
              } else if (module==='quotations') {
                col(12,'No.'); col(60,'Customer'); col(120,'Date'); col(155,'Estimate'); col(180,'Balance'); row();
                (data as any).list.forEach((q:any)=> { const sub=q.items.reduce((s:any,it:any)=>s+it.qty*it.price,0); const discount=q.discountPct?(sub*q.discountPct)/100:0; const shipping=q.shipping||0; const grand=Math.max(0,sub-discount+shipping); const bal=Math.max(0, grand - PaymentStore.sumAmount(PaymentStore.byQuote(q.id))); col(12,q.number); col(60,q.customer.name); col(120,new Date(q.createdAt).toLocaleDateString()); col(155,grand.toFixed(2)); col(180,bal.toFixed(2)); row(); });
              } else if (module==='payments') {
                col(12,'Date'); col(60,'Customer'); col(120,'Applied'); col(160,'Amount'); row();
                (data as any).list.forEach((p:any)=> { col(12,new Date(p.date).toLocaleDateString()); col(60,((allCustomers.find((c:any)=> c.id===p.customerId)?.name)||p.customerId)); col(120,(p.invoiceId?`Invoice ${p.invoiceId}`:(p.quoteId?`Quote ${p.quoteId}`:'Unapplied'))); col(160,(p.amount||0).toFixed(2)); row(); });
              }
              // Footer with timestamp and page numbers
              try {
                const pageCount = (pdf as any).getNumberOfPages ? (pdf as any).getNumberOfPages() : (pdf as any).internal.getNumberOfPages();
                for (let p = 1; p <= pageCount; p++) {
                  (pdf as any).setPage(p);
                  pdf.setFontSize(9); pdf.setTextColor(120,120,128);
                  const stamp = `Generated ${new Date().toLocaleString()} • Page ${p}/${pageCount}`;
                  pdf.text(stamp, 105, 290, { align: 'center' as any });
                }
              } catch {}
              pdf.save(`report_${module}_${from}_to_${to}.pdf`);
            }}>Export PDF</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {module === 'income' && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Invoices</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.invTotal||0).toFixed(2)}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Sales</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.salesTotal||0).toFixed(2)}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Credits</div><div className="text-xl font-semibold">-{cs.currencySymbol}{((data as any).totals.creditsTotal||0).toFixed(2)}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Gross</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.gross||0).toFixed(2)}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Net</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.net||0).toFixed(2)}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Cash Received</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.cashReceived||0).toFixed(2)}</div></div>
            </div>
          )}
          {module === 'expenses' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Count</div><div className="text-xl font-semibold">{(data as any).totals.count}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.total||0).toFixed(2)}</div></div>
            </div>
          )}
          {module === 'income_vs_expense' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Income (Accrual)</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.income||0).toFixed(2)}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Expenses</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.expenses||0).toFixed(2)}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Net</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.net||0).toFixed(2)}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Cash Received</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.cashReceived||0).toFixed(2)}</div></div>
            </div>
          )}
          {module === 'invoices' || module === 'quotations' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Count</div><div className="text-xl font-semibold">{(data as any).totals.count}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.total||0).toFixed(2)}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Paid/Deposits</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.paid||0).toFixed(2)}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Balance</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.balance||0).toFixed(2)}</div></div>
            </div>
          ) : module === 'payments' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Count</div><div className="text-xl font-semibold">{(data as any).totals.count}</div></div>
              <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Amount</div><div className="text-xl font-semibold">{cs.currencySymbol}{((data as any).totals.amount||0).toFixed(2)}</div></div>
            </div>
          ) : null}

          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                {module === 'income' && (
                  <TableRow><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                )}
                {module === 'expenses' && (
                  <TableRow><TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                )}
                {module === 'income_vs_expense' && (
                  <TableRow><TableHead>Metric</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                )}
                {module === 'invoices' && (
                  <TableRow><TableHead>No.</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead></TableRow>
                )}
                {module === 'quotations' && (
                  <TableRow><TableHead>No.</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Estimate</TableHead><TableHead className="text-right">Deposits</TableHead><TableHead className="text-right">Balance</TableHead></TableRow>
                )}
                {module === 'payments' && (
                  <TableRow><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Applied To</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                )}
              </TableHeader>
              <TableBody>
                {module === 'income' && (
                  <>
                    {(data as any).invs.map((i: Invoice) => (
                      <TableRow key={i.id}><TableCell>Invoice {i.number}</TableCell><TableCell>{new Date(i.createdAt).toLocaleDateString()}</TableCell><TableCell className="text-right">{cs.currencySymbol}{i.items.reduce((s,it)=> s+it.qty*it.price, 0).toFixed(2)}</TableCell></TableRow>
                    ))}
                    {(data as any).sales.map((s: any) => (
                      <TableRow key={s.id}><TableCell>Sale {s.number}</TableCell><TableCell>{new Date(s.date).toLocaleDateString()}</TableCell><TableCell className="text-right">{cs.currencySymbol}{s.items.reduce((su: number,it: any)=> su+it.qty*it.price, 0).toFixed(2)}</TableCell></TableRow>
                    ))}
                    {(data as any).credits.map((c: any) => (
                      <TableRow key={c.id}><TableCell>Credit {c.number}</TableCell><TableCell>{new Date(c.date).toLocaleDateString()}</TableCell><TableCell className="text-right">-{cs.currencySymbol}{(c.amount||0).toFixed(2)}</TableCell></TableRow>
                    ))}
                  </>
                )}
                {module === 'expenses' && (
                  (data as any).ex.map((e: any) => (
                    <TableRow key={e.id}><TableCell>{new Date(e.date).toLocaleDateString()}</TableCell><TableCell>{e.vendor}</TableCell><TableCell>{e.category}</TableCell><TableCell className="text-right">{cs.currencySymbol}{((e.amount||0)+(e.tax||0)).toFixed(2)}</TableCell></TableRow>
                  ))
                )}
                {module === 'income_vs_expense' && (
                  <>
                    <TableRow><TableCell>Income (Accrual)</TableCell><TableCell className="text-right">{cs.currencySymbol}{((data as any).totals.income||0).toFixed(2)}</TableCell></TableRow>
                    <TableRow><TableCell>Expenses</TableCell><TableCell className="text-right">{cs.currencySymbol}{((data as any).totals.expenses||0).toFixed(2)}</TableCell></TableRow>
                    <TableRow><TableCell>Net</TableCell><TableCell className="text-right">{cs.currencySymbol}{((data as any).totals.net||0).toFixed(2)}</TableCell></TableRow>
                    <TableRow><TableCell>Cash Received (Payments)</TableCell><TableCell className="text-right">{cs.currencySymbol}{((data as any).totals.cashReceived||0).toFixed(2)}</TableCell></TableRow>
                  </>
                )}
                {module === 'invoices' && (data as any).list.map((i: Invoice) => {
                  const sub = i.items.reduce((s,it)=> s + it.qty*it.price, 0);
                  const paid = PaymentStore.sumAmount(PaymentStore.byInvoice(i.id));
                  return (
                    <TableRow key={i.id}>
                      <TableCell>{i.number}</TableCell>
                      <TableCell>{i.customer.name}</TableCell>
                      <TableCell>{new Date(i.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{cs.currencySymbol}{sub.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{cs.currencySymbol}{paid.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{cs.currencySymbol}{Math.max(0, sub - paid).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
                {module === 'quotations' && (data as any).list.map((q: Quotation) => {
                  const sub = q.items.reduce((s,it)=> s + it.qty*it.price, 0);
                  const discount = q.discountPct ? (sub * q.discountPct)/100 : 0;
                  const shipping = q.shipping || 0;
                  const grand = Math.max(0, sub - discount + shipping);
                  const paid = PaymentStore.sumAmount(PaymentStore.byQuote(q.id));
                  return (
                    <TableRow key={q.id}>
                      <TableCell>{q.number}</TableCell>
                      <TableCell>{q.customer.name}</TableCell>
                      <TableCell>{new Date(q.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{cs.currencySymbol}{grand.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{cs.currencySymbol}{paid.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{cs.currencySymbol}{Math.max(0, grand - paid).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
                {module === 'payments' && (data as any).list.map((p: Payment) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.date).toLocaleDateString()}</TableCell>
                    <TableCell>{(allCustomers.find(c=> c.id===p.customerId)?.name) || p.customerId}</TableCell>
                    <TableCell>{p.invoiceId ? `Invoice ${p.invoiceId}` : (p.quoteId ? `Quote ${p.quoteId}` : 'Unapplied')}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>{p.reference}</TableCell>
                    <TableCell className="text-right">{cs.currencySymbol}{(p.amount||0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
