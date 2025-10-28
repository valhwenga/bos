import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AccountingStore, Quotation } from "@/lib/accountingStore";
import { CompanySettingsStore } from "@/lib/companySettings";
import { Button } from "@/components/ui/button";
import { PaymentStore } from "@/lib/paymentStore";

const currency = (v: number, sym: string) => `${sym}${v.toFixed(2)}`;

const QuotationPrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onPayments = () => setTick((t)=> t+1);
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("acct.payments") || e.key.startsWith("acct.quotes")) setTick((t)=> t+1);
    };
    window.addEventListener('payments-changed', onPayments as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('payments-changed', onPayments as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const q = AccountingStore.listQuotes().find(i => i.id === id);
  const c = CompanySettingsStore.get();
  const billTo = useMemo(() => {
    const cust = q?.customer;
    if (!cust) return undefined;
    const useShip = q?.useShippingAddress;
    const addr = useShip ? (cust.shippingAddress || cust.billingAddress) : (cust.billingAddress || cust.shippingAddress);
    return { cust, addr };
  }, [q]);

  const totals = useMemo(() => {
    if (!q) return { sub: 0, discount: 0, shipping: 0, grand: 0 };
    const sub = q.items.reduce((s, it) => s + it.qty * it.price, 0);
    const discount = q.discountPct ? (sub * q.discountPct) / 100 : 0;
    const shipping = q.shipping || 0;
    const grand = sub - discount + shipping;
    return { sub, discount, shipping, grand };
  }, [q, tick]);

  const paid = useMemo(() => q ? PaymentStore.sumAmount(PaymentStore.byQuote(q.id)) : 0, [q, tick]);
  const balance = Math.max(0, (totals.grand || 0) - (paid || 0));

  if (!q) return (
    <div className="p-6">
      <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
      <div className="mt-4">Quotation not found.</div>
    </div>
  );

  const downloadPdf = async () => {
    const ensureScript = (src: string) => new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
    const w = window as any;
    if (!w.html2canvas) await ensureScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    if (!w.jspdf) await ensureScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    const el = document.getElementById('print-root');
    if (!el) return;
    const canvas = await w.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = (w.jspdf || w.jspdf_esm || w.jspdfjs) as any;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210; const pdfHeight = 297;
    const imgWidth = pdfWidth; const imgHeight = canvas.height * imgWidth / canvas.width;
    let position = 0; let heightLeft = imgHeight;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
    pdf.save(`${q.number || 'quotation'}.pdf`);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-4 flex items-center justify-between print:hidden">
        <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadPdf}>Download PDF</Button>
          <Button onClick={()=> window.print()}>Print</Button>
        </div>
      </div>

      <div id="print-root" className="relative mx-auto bg-white shadow print:shadow-none border print:border-0 overflow-hidden" style={{ width: '210mm', minHeight: '297mm' }}>
        {/* Watermark */}
        {c.logoDataUrl && (
          <img src={c.logoDataUrl} aria-hidden className="pointer-events-none select-none opacity-[0.035] absolute -right-16 -bottom-10 w-[300mm] max-w-none -z-10" />
        )}
        {/* Document padding wrapper */}
        <div className="relative z-10 pb-10">
          {/* Header with gradient brand bar */}
          <div className="bg-gradient-to-r from-[#5F33FF] to-[#7A60D9] text-white">
            <div className="p-10 flex items-start justify-between">
              {c.logoDataUrl && (
                <img src={c.logoDataUrl} className="h-16 w-auto object-contain drop-shadow" />
              )}
              <div className="text-sm text-right">
                <div className="text-xl font-semibold tracking-wide">{c.name}</div>
                {c.address && <div className="mt-1 opacity-90 whitespace-pre-wrap">{c.address}</div>}
                <div className="mt-1 opacity-90">{c.email}{c.email && (c.phone ? ' • ' : '')}{c.phone}</div>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="px-10 pt-8">
            <div className="text-3xl tracking-[0.3em] font-semibold text-slate-900">QUOTE</div>
            <div className="mt-2 h-1 rounded bg-gradient-to-r from-[#5F33FF] to-[#7A60D9] w-40" />
          </div>

          {/* Meta: Quote To and Details */}
          <div className="px-10 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 mt-4">
            <div className="text-sm">
              <div className="uppercase text-[11px] tracking-wide text-slate-700">Bill To</div>
              <div className="mt-1 font-medium text-slate-900">{q.customer.companyName || q.customer.name}</div>
              <div className="text-slate-900">{q.customer.name}</div>
              {q.customer.email && <div className="text-slate-800">{q.customer.email}</div>}
              {billTo?.addr && (
                <div className="text-slate-800 mt-1 whitespace-pre-line">
                  {(billTo.addr.line1||"")}
                  {billTo.addr.line2 ? `\n${billTo.addr.line2}`: ""}
                  {billTo.addr.city || billTo.addr.state || billTo.addr.postalCode ? `\n${[billTo.addr.city, billTo.addr.state, billTo.addr.postalCode].filter(Boolean).join(', ')}`: ""}
                  {billTo.addr.country ? `\n${billTo.addr.country}`: ""}
                </div>
              )}
              {q.customer.responsible?.name && (
                <div className="mt-1 text-slate-800">Attn: {q.customer.responsible.name}{q.customer.responsible.title ? `, ${q.customer.responsible.title}`: ""}</div>
              )}
            </div>
            <div className="text-sm">
              <div className="uppercase text-[11px] tracking-wide text-slate-700">Quote Details</div>
              <div className="mt-1 text-slate-900">Quote No: <span className="font-medium">{q.number}</span></div>
              <div className="text-slate-900">Date: {new Date(q.createdAt).toLocaleDateString()}</div>
              {q.expiryDate && <div className="text-slate-900">Valid Until: {new Date(q.expiryDate).toLocaleDateString()}</div>}
              <div className="mt-2 text-slate-900">Estimate Total: <span className="font-semibold">{currency(totals.grand, c.currencySymbol)}</span></div>
              <div className="text-slate-900">Deposits: <span className="font-semibold">{currency(paid, c.currencySymbol)}</span></div>
              <div className="text-slate-900">Balance Due: <span className="font-semibold">{currency(balance, c.currencySymbol)}</span></div>
            </div>
          </div>

          {q.subject && <div className="px-10 mb-3 text-sm font-medium text-slate-900">Subject: {q.subject}</div>}
          {q.reference && <div className="px-10 mb-3 text-xs text-slate-800">Reference: {q.reference}</div>}

          {/* Items table */}
          <div className="px-10">
            <div className="rounded border overflow-hidden">
            <table className="w-full text-sm leading-tight">
              <thead className="text-white bg-gradient-to-r from-[#5F33FF] to-[#7A60D9]">
                <tr>
                  <th className="text-left p-2 font-semibold">Descriptions</th>
                  <th className="text-right p-2 font-semibold">Unit Price</th>
                  <th className="text-right p-2 font-semibold">Quantity</th>
                  <th className="text-right p-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((it) => (
                  <tr key={it.id} className="border-t text-slate-900">
                    <td className="p-2 align-top">
                      <div className="font-medium text-slate-900">{it.name}</div>
                      {it.description && <div className="text-xs text-slate-800 mt-1">{it.description}</div>}
                    </td>
                    <td className="p-2 text-right align-top">{currency(it.price, c.currencySymbol)}</td>
                    <td className="p-2 text-right align-top">{it.qty}</td>
                    <td className="p-2 text-right align-top">{currency(it.qty * it.price, c.currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50">
                  <td className="p-2" colSpan={2}></td>
                  <td className="p-2 text-right text-xs text-slate-900 font-semibold">Sub Total</td>
                  <td className="p-2 text-right text-slate-900 font-semibold">{currency(totals.sub, c.currencySymbol)}</td>
                </tr>
                {q.discountPct ? (
                  <tr className="border-t bg-slate-50">
                    <td className="p-2" colSpan={2}></td>
                    <td className="p-2 text-right text-xs text-slate-600">Discount ({q.discountPct}%)</td>
                    <td className="p-2 text-right font-medium">-{currency(totals.discount, c.currencySymbol)}</td>
                  </tr>
                ) : null}
                {q.shipping ? (
                  <tr className="border-t bg-slate-50">
                    <td className="p-2" colSpan={2}></td>
                    <td className="p-2 text-right text-xs text-slate-600">Shipping</td>
                    <td className="p-2 text-right font-medium">{currency(totals.shipping, c.currencySymbol)}</td>
                  </tr>
                ) : null}
                <tr className="border-t-2">
                  <td className="p-2" colSpan={2}></td>
                  <td className="p-2 text-right text-base font-extrabold text-slate-900">GRAND TOTAL</td>
                  <td className="p-2 text-right text-base font-extrabold text-slate-900">{currency(totals.grand, c.currencySymbol)}</td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>

          {/* Notes and Totals */}
          <div className="px-10 mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-sm text-slate-600">
              <div className="mb-4">Thank You For Your Business!</div>
              {(q.notes || c.footerNote) && (
                <div>
                  <div className="font-medium mb-1">Notes</div>
                  <div className="text-xs text-slate-500 whitespace-pre-wrap">{q.notes || c.footerNote}</div>
                </div>
              )}
              {/* Banking details */}
              <div className="mt-6 text-xs text-slate-900">
                <div className="uppercase text-[11px] tracking-wide text-slate-700">Banking Details</div>
                {c.bankName && <div className="mt-1"><span className="font-semibold">Bank Name:</span> {c.bankName}</div>}
                {c.bankAccount && <div><span className="font-semibold">Account Number:</span> {c.bankAccount}</div>}
                {c.branchCode && <div><span className="font-semibold">Branch Code:</span> {c.branchCode}</div>}
                {c.branchName && <div><span className="font-semibold">Branch Name:</span> {c.branchName}</div>}
                <div><span className="font-semibold">Reference:</span> {q.number}</div>
              </div>
            </div>
            <div className="">
              <div className="ml-auto w-64">
                <div className="flex items-center justify-between py-1 text-sm">
                  <div>Sub Total</div>
                  <div>{currency(totals.sub, c.currencySymbol)}</div>
                </div>
                {q.discountPct ? (
                  <div className="flex items-center justify-between py-1 text-sm">
                    <div>Discount ({q.discountPct}%)</div>
                    <div>-{currency(totals.discount, c.currencySymbol)}</div>
                  </div>
                ) : null}
                {q.shipping ? (
                  <div className="flex items-center justify-between py-1 text-sm">
                    <div>Shipping</div>
                    <div>{currency(totals.shipping, c.currencySymbol)}</div>
                  </div>
                ) : null}
                <div className="h-px bg-slate-300 my-2" />
                <div className="flex items-center justify-between py-1 font-semibold">
                  <div>GRAND TOTAL</div>
                  <div>{currency(totals.grand, c.currencySymbol)}</div>
                </div>
                <div className="flex items-center justify-between py-1 text-sm">
                  <div>Deposits</div>
                  <div>{currency(paid, c.currencySymbol)}</div>
                </div>
                <div className="flex items-center justify-between py-1 font-extrabold text-slate-900">
                  <div>BALANCE DUE</div>
                  <div>{currency(balance, c.currencySymbol)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-10 mt-10 flex items-center justify-between">
            <div className="text-sm text-slate-500">This is a quotation only. Final invoice will be issued upon acceptance.</div>
            <div className="text-right">
              {c.signatureDataUrl ? (
                <div className="flex flex-col items-end">
                  <img src={c.signatureDataUrl} alt="signature" className="h-12 w-auto object-contain" />
                  <div className="text-xs text-slate-500 mt-1">Authorized Signature</div>
                </div>
              ) : (
                <>
                  <div className="text-sm">________________________</div>
                  <div className="text-xs text-slate-500 mt-1">Authorized Signature</div>
                </>
              )}
            </div>
          </div>
          {/* Bottom gradient bar */}
          <div className="mt-8 h-1 w-full bg-gradient-to-r from-[#5F33FF] to-[#7A60D9]" />
        </div>
      </div>

      <style>{`@page { size: A4; margin: 12mm; } @media print { body { -webkit-print-color-adjust: exact; } .print\:hidden{display:none;} .print\:shadow-none{box-shadow:none} .print\:border-0{border:0} html, body { height: auto; } }`}</style>
    </div>
  );
};

export default QuotationPrint;
