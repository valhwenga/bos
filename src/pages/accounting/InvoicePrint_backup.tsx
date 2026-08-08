import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AccountingStore, Invoice } from "@/lib/accountingStore";
import { CompanySettingsStore } from "@/lib/companySettings";
import { Button } from "@/components/ui/button";
import { PaymentStore } from "@/lib/paymentStore";
import { CreditNotesStore } from "@/lib/creditNotesStore";

const currency = (v: number, sym: string) => `${sym}${v.toFixed(2)}`;

const InvoicePrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onPayments = () => setTick((t)=> t+1);
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("acct.payments") || e.key.startsWith("acct.invoices")) setTick((t)=> t+1);
    };
    window.addEventListener('payments-changed', onPayments as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('payments-changed', onPayments as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const inv = AccountingStore.listInvoices().find(i => i.id === id);
  const c = CompanySettingsStore.get();
  const billTo = useMemo(() => {
    const cust = inv?.customer;
    if (!cust) return undefined;
    const useShip = inv?.useShippingAddress;
    const addr = useShip ? (cust.shippingAddress || cust.billingAddress) : (cust.billingAddress || cust.shippingAddress);
    return { cust, addr };
  }, [inv]);

  const totals = useMemo(() => {
    if (!inv) return { subtotal: 0, tax: 0, grand: 0 };
    const subtotal = inv.items.reduce((s, it) => s + it.qty * it.price, 0);
    const tax = 0; // customize if you add tax support later
    const grand = subtotal + tax;
    return { subtotal, tax, grand };
  }, [inv]);

  const paid = useMemo(() => inv ? PaymentStore.sumAmount(PaymentStore.byInvoice(inv.id)) : 0, [inv, tick]);
  const credits = useMemo(() => inv ? CreditNotesStore.sumAppliedToInvoice(inv.id) : 0, [inv, tick]);
  const balance = Math.max(0, (totals.grand || 0) - (paid || 0) - (credits || 0));

  if (!inv) return (
    <div className="p-6">
      <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
      <div className="mt-4">Invoice not found.</div>
    </div>
  );

  const downloadPdf = async () => {
    const ensureScript = (src: string) => new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
    const w = window as unknown as {
      html2canvas?: (el: HTMLElement, opts?: unknown) => Promise<HTMLCanvasElement>;
      jspdf?: unknown;
      jspdf_esm?: unknown;
      jspdfjs?: unknown;
    };
    if (!w.html2canvas) await ensureScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    if (!w.jspdf) await ensureScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    const el = document.getElementById('print-root');
    if (!el) return;
    const canvas = await w.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = (w.jspdf || w.jspdf_esm || w.jspdfjs) as { jsPDF: new (...args: unknown[]) => unknown };
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
    pdf.save(`${inv?.number || 'invoice'}.pdf`);
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

      <div id="print-root" className="relative mx-auto bg-white shadow print:shadow-none print:border-0 overflow-hidden" style={{ width: '210mm', minHeight: '297mm' }}>
        {/* Watermark */}
        {c.logoDataUrl && (
          <img src={c.logoDataUrl} aria-hidden className="pointer-events-none select-none opacity-[0.035] absolute -right-16 -bottom-10 w-[300mm] max-w-none -z-10" />
        )}
        <div className="relative z-10 pb-10">
          {/* Top colored edge */}
          <div className="h-2 bg-gradient-to-r from-[#5F33FF] via-[#7A60D9] to-[#5F33FF]"></div>
          
          {/* Main content with colored edges */}
          <div className="border-x-4 border-[#5F33FF]">
            {/* Clean Header with Logo */}
            <div className="bg-white border-b border-gray-200">
              <div className="p-10 flex items-start justify-between">
                <div className="flex-1">
                  {c.logoDataUrl && (
                    <div className="mb-4 bg-white p-5 rounded-lg inline-block">
                      <img src={c.logoDataUrl} className="h-32 w-auto max-w-[320px] object-contain" />
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    <div className="mt-2">
                      <div className="font-bold text-base">Invoice No:</div>
                      <div className="text-base font-semibold">{inv.number}</div>
                    </div>
                    <div className="mt-2">
                      <div className="font-bold text-base">Date:</div>
                      <div className="text-base font-semibold">{new Date(inv.createdAt).toLocaleDateString('en-GB')}</div>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-8">
                  <div className="text-3xl font-bold text-gray-900">INVOICE</div>
                  <div className="mt-4 text-sm text-gray-600 space-y-1">
                    <div className="text-xl font-semibold text-gray-900">Spike Technologies</div>
                    <div>
                      <div className="font-medium">Company registration</div>
                      <div>2021/847783/07</div>
                    </div>
                    <div>
                      <div className="font-medium">Website</div>
                      <div>www.spiketech.co.za</div>
                    </div>
                    <div>
                      <div className="font-medium">Email</div>
                      <div>accounts@spiketech.co.za</div>
                    </div>
                    {c.phone && (
                      <div>
                        <div className="font-medium">Phone</div>
                        <div>{c.phone}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To Section */}
            <div className="px-10 mt-8">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Bill To */}
                  <div>
                    <div className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-3">Bill To</div>
                    <div className="text-gray-900">
                      <div className="font-semibold text-lg">{inv.customer.companyName || inv.customer.name}</div>
                      <div className="text-gray-700">{inv.customer.name}</div>
                      {inv.customer.email && <div className="text-gray-600">{inv.customer.email}</div>}
                      {inv.customer.responsible?.name && (
                        <div className="mt-2 text-gray-600">Attn: {inv.customer.responsible.name}{inv.customer.responsible.title ? `, ${inv.customer.responsible.title}`: ""}</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Right Column - Address */}
                  {billTo?.addr && (
                    <div>
                      <div className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-3">Address</div>
                      <div className="text-gray-600 whitespace-pre-line">
                        {(billTo.addr.line1||"")}
                        {billTo.addr.line2 ? `\n${billTo.addr.line2}`: ""}
                        {billTo.addr.city || billTo.addr.state || billTo.addr.postalCode ? `\n${[billTo.addr.city, billTo.addr.state, billTo.addr.postalCode].filter(Boolean).join(', ')}`: ""}
                        {billTo.addr.country ? `\n${billTo.addr.country}`: ""}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="px-10 mt-8">
              <div className="rounded border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-[#5F33FF] to-[#7A60D9] text-white">
                    <tr>
                      <th className="text-left p-4 font-semibold">Description</th>
                      <th className="text-right p-4 font-semibold">Unit Price</th>
                      <th className="text-right p-4 font-semibold">Quantity</th>
                      <th className="text-right p-4 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.items.map((it) => (
                      <tr key={it.id} className="border-b border-gray-100">
                        <td className="p-4 align-top">
                          <div className="font-medium text-gray-900">{it.name}</div>
                          {it.description && <div className="text-xs text-gray-600 mt-1">{it.description}</div>}
                        </td>
                        <td className="p-4 text-right align-top text-gray-900">{currency(it.price, c.currencySymbol)}</td>
                        <td className="p-4 text-right align-top text-gray-900">{it.qty}</td>
                        <td className="p-4 text-right align-top font-medium text-gray-900">{currency(it.qty * it.price, c.currencySymbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                      <td className="p-4" colSpan={3}></td>
                      <td className="p-4 text-right text-xs text-gray-900 font-semibold whitespace-nowrap">Sub Total</td>
                      <td className="p-4 text-right text-gray-900 font-semibold">{currency(totals.subtotal, c.currencySymbol)}</td>
                    </tr>
                    <tr className="border-t border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                      <td className="p-4" colSpan={3}></td>
                      <td className="p-4 text-right text-xs text-gray-600 whitespace-nowrap">Tax (VAT)</td>
                      <td className="p-4 text-right font-medium">{currency(totals.tax, c.currencySymbol)}</td>
                    </tr>
                    <tr className="border-t-2 border-[#5F33FF] bg-gradient-to-r from-[#5F33FF] to-[#7A60D9]">
                      <td className="p-4" colSpan={3}></td>
                      <td className="p-4 text-right text-base font-extrabold text-white whitespace-nowrap">TOTAL</td>
                      <td className="p-4 text-right text-base font-extrabold text-white">{currency(totals.grand, c.currencySymbol)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Summary Section */}
            <div className="px-10 mt-8">
              <div className="text-sm text-gray-600">
                <div className="mb-4 font-medium">Thank You For Your Business!</div>
                {c.footerNote && (
                  <div>
                    <div className="font-medium mb-2">Terms & Conditions</div>
                    <div className="text-xs text-gray-500 whitespace-pre-wrap">{c.footerNote}</div>
                  </div>
                )}
              </div>
              
              {/* Side by side boxes */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Banking Details Box */}
                <div>
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg px-8 py-6 border border-purple-100">
                    <div className="font-medium mb-2">Banking Details</div>
                    <div className="text-xs text-gray-700 space-y-1">
                      {c.bankName && <div><span className="font-semibold">Bank:</span> {c.bankName}</div>}
                      {c.bankAccount && <div><span className="font-semibold">Account:</span> {c.bankAccount}</div>}
                      {c.branchCode && <div><span className="font-semibold">Branch Code:</span> {c.branchCode}</div>}
                      {c.branchName && <div><span className="font-semibold">Branch:</span> {c.branchName}</div>}
                      <div><span className="font-semibold">Reference:</span> {inv.number}</div>
                    </div>
                  </div>
                </div>
                
                {/* Balance Due Box */}
                <div>
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg px-8 py-6 border border-purple-100">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 whitespace-nowrap">Sub Total</span>
                        <span className="font-medium">{currency(totals.subtotal, c.currencySymbol)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 whitespace-nowrap">Tax (VAT)</span>
                        <span className="font-medium">{currency(totals.tax, c.currencySymbol)}</span>
                      </div>
                      <div className="border-t border-purple-200 pt-2 mt-2">
                        <div className="flex justify-between font-semibold text-gray-900">
                          <span className="whitespace-nowrap">TOTAL</span>
                          <span>{currency(totals.grand, c.currencySymbol)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 whitespace-nowrap">Deposits</span>
                        <span className="font-medium">{currency(paid, c.currencySymbol)}</span>
                      </div>
                      <div className="border-t border-purple-200 pt-2 mt-2">
                        <div className="flex justify-between font-bold text-lg text-gray-900">
                          <span className="whitespace-nowrap">BALANCE DUE</span>
                          <span>{currency(balance, c.currencySymbol)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="px-10 mt-8">
            <div className="rounded border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-[#5F33FF] to-[#7A60D9] text-white">
                  <tr>
                    <th className="text-left p-4 font-semibold">Description</th>
                    <th className="text-right p-4 font-semibold">Unit Price</th>
                    <th className="text-right p-4 font-semibold">Quantity</th>
                    <th className="text-right p-4 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it) => (
                    <tr key={it.id} className="border-b border-gray-100">
                      <td className="p-4 align-top">
                        <div className="font-medium text-gray-900">{it.name}</div>
                        {it.description && <div className="text-xs text-gray-600 mt-1">{it.description}</div>}
                      </td>
                      <td className="p-4 text-right align-top text-gray-900">{currency(it.price, c.currencySymbol)}</td>
                      <td className="p-4 text-right align-top text-gray-900">{it.qty}</td>
                      <td className="p-4 text-right align-top font-medium text-gray-900">{currency(it.qty * it.price, c.currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                    <td className="p-4" colSpan={3}></td>
                    <td className="p-4 text-right text-xs text-gray-900 font-semibold whitespace-nowrap">Sub Total</td>
                    <td className="p-4 text-right text-gray-900 font-semibold">{currency(totals.subtotal, c.currencySymbol)}</td>
                  </tr>
                  <tr className="border-t border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                    <td className="p-4" colSpan={3}></td>
                    <td className="p-4 text-right text-xs text-gray-600 whitespace-nowrap">Tax (VAT)</td>
                    <td className="p-4 text-right font-medium">{currency(totals.tax, c.currencySymbol)}</td>
                  </tr>
                  <tr className="border-t-2 border-[#5F33FF] bg-gradient-to-r from-[#5F33FF] to-[#7A60D9]">
                    <td className="p-4" colSpan={3}></td>
                    <td className="p-4 text-right text-base font-extrabold text-white whitespace-nowrap">TOTAL</td>
                    <td className="p-4 text-right text-base font-extrabold text-white">{currency(totals.grand, c.currencySymbol)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary Section */}
          <div className="px-10 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <div className="text-sm text-gray-600">
                  <div className="mb-4 font-medium">Thank You For Your Business!</div>
                  {c.footerNote && (
                    <div>
                      <div className="font-medium mb-2">Terms & Conditions</div>
                      <div className="text-xs text-gray-500 whitespace-pre-wrap">{c.footerNote}</div>
                    </div>
                  )}
                  {/* Banking details in separate box */}
                  <div className="mt-6">
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg px-8 py-6 border border-purple-100">
                      <div className="font-medium mb-2">Banking Details</div>
                      <div className="text-xs text-gray-700 space-y-1">
                        {c.bankName && <div><span className="font-semibold">Bank:</span> {c.bankName}</div>}
                        {c.bankAccount && <div><span className="font-semibold">Account:</span> {c.bankAccount}</div>}
                        {c.branchCode && <div><span className="font-semibold">Branch Code:</span> {c.branchCode}</div>}
                        {c.branchName && <div><span className="font-semibold">Branch:</span> {c.branchName}</div>}
                        <div><span className="font-semibold">Reference:</span> {inv.number}</div>
                      </div>
                    </div>
                  </div>
                </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 whitespace-nowrap">Sub Total</span>
                        <span className="font-medium">{currency(totals.subtotal, c.currencySymbol)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 whitespace-nowrap">Tax (VAT)</span>
                        <span className="font-medium">{currency(totals.tax, c.currencySymbol)}</span>
                      </div>
                      <div className="border-t border-purple-200 pt-2 mt-2">
                        <div className="flex justify-between font-semibold text-gray-900">
                          <span className="whitespace-nowrap">TOTAL</span>
                          <span>{currency(totals.grand, c.currencySymbol)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 whitespace-nowrap">Deposits</span>
                        <span className="font-medium">{currency(paid, c.currencySymbol)}</span>
                      </div>
                      <div className="border-t border-purple-200 pt-2 mt-2">
                        <div className="flex justify-between font-bold text-lg text-gray-900">
                          <span className="whitespace-nowrap">BALANCE DUE</span>
                          <span>{currency(balance, c.currencySymbol)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-10 mt-10 flex items-center justify-between border-t border-gray-200 pt-8">
              <div className="text-sm text-gray-500">Payment via bank transfer. Please include invoice number as reference.</div>
              <div className="text-right">
                {c.signatureDataUrl ? (
                  <div className="flex flex-col items-end">
                    <img src={c.signatureDataUrl} alt="signature" className="h-12 w-auto object-contain" />
                    <div className="text-xs text-gray-500 mt-1">Authorized Signature</div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm">________________________</div>
                    <div className="text-xs text-gray-500 mt-1">Authorized Signature</div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Bottom colored edge */}
          <div className="h-2 bg-gradient-to-r from-[#5F33FF] via-[#7A60D9] to-[#5F33FF]"></div>
        </div>
      </div>

      <style>{`@page { size: A4; margin: 12mm; } @media print { body { -webkit-print-color-adjust: exact; } .print\\:hidden{display:none;} .print\\:shadow-none{box-shadow:none} .print\\:border-0{border:0} html, body { height: auto; } }`}</style>
    </div>
  );
};

export default InvoicePrint;
