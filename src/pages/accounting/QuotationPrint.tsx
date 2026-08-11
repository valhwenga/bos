import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AccountingStore, Quotation } from "@/lib/accountingStore";
import { CompanySettingsStore } from "@/lib/companySettings";
import { a4PrintCss } from "@/lib/printStyles";
import { useFitToPage } from "@/lib/useFitToPage";
import { Button } from "@/components/ui/button";
import { PaymentStore } from "@/lib/paymentStore";
import { PDF_COLORS, PDF_CONFIG, generatePDFHTML } from "@/lib/pdfGenerator";

const currency = (v: number, sym: string) => `${sym}${v.toFixed(2)}`;

const QuotationPrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  useEffect(() => {
    const onPayments = () => {
      // Only update if this quotation is affected
      const currentQuote = AccountingStore.listQuotes().find(i => i.id === id);
      if (currentQuote) {
        setTick((t)=> t+1);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      // Only update for relevant storage changes
      if ((e.key.startsWith("acct.payments") || e.key.startsWith("acct.quotes")) && e.key.includes(id)) {
        setTick((t)=> t+1);
      }
    };
    window.addEventListener('payments-changed', onPayments as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('payments-changed', onPayments as any);
      window.removeEventListener('storage', onStorage);
    };
  }, [id]);

  const q: Quotation | undefined = AccountingStore.listQuotes().find(i => i.id === id);
  const c = CompanySettingsStore.get();
  const sheetRef = useRef<HTMLDivElement>(null);
  const fitScale = useFitToPage(sheetRef, [q]);
  const billTo = useMemo(() => {
    const cust = q?.customer;
    if (!cust) return undefined;
    const useShip = q?.useShippingAddress;
    const addr = useShip ? (cust.shippingAddress || cust.billingAddress) : (cust.billingAddress || cust.shippingAddress);
    return { cust, addr };
  }, [q]);

  const totals = useMemo(() => {
    if (!q) return { subtotal: 0, tax: 0, grand: 0 };
    const subtotal = q.items.reduce((s, it) => s + it.qty * it.price, 0);
    const tax = 0; // customize if you add tax support later
    const grand = subtotal + tax;
    return { subtotal, tax, grand };
  }, [q, tick]);

  const paid = useMemo(() => q ? PaymentStore.sumAmount(PaymentStore.byQuote(q.id)) : 0, [q, tick]);
  const balance = Math.max(0, (totals.grand || 0) - (paid || 0));

  if (!q) return (
    <div className="p-6">
      <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
      <div className="mt-3">Quotation not found.</div>
    </div>
  );

  const downloadPdf = async () => {
    setIsGenerating(true);
    try {
      if (!q) {
        console.error('No quotation data found');
        return;
      }
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        console.error('Could not open print window');
        return;
      }
      
      // Prepare data for shared PDF generator
      const pdfData = {
        number: q.number || 'QUOTATION',
        date: q.createdAt || new Date().toISOString().split('T')[0],
        validUntil: q.expiryDate,
        customer: {
          name: billTo?.cust?.name || '',
          companyName: billTo?.cust?.companyName || '',
          email: billTo?.cust?.email || '',
          responsible: billTo?.cust?.responsible
        },
        items: q.items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          qty: item.qty
        }))
      };
      
      const companyData = {
        name: c.name,
        logoDataUrl: c.logoDataUrl,
        address: c.address,
        email: c.email,
        phone: c.phone,
        currencySymbol: c.currencySymbol,
        bankName: c.bankName,
        bankAccount: c.bankAccount,
        branchCode: c.branchCode,
        branchName: c.branchName,
        footerNote: c.footerNote
      };
      
      const billToData = {
        addr: billTo?.addr
      };
      
      const totalsData = {
        subtotal: totals.subtotal,
        tax: totals.tax,
        grand: totals.grand,
        paid: paid,
        balance: balance
      };
      
      // Generate HTML using shared function
      const htmlContent = generatePDFHTML('quotation', pdfData, companyData, billToData, totalsData);
      
      // Write the content to the new window
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Wait for content to load, then trigger print
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        
        // Close the window after printing (with delay to allow print dialog)
        setTimeout(() => {
          printWindow.close();
        }, PDF_CONFIG.windowCloseDelay);
      }, PDF_CONFIG.printDelay);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
    <div className="min-h-screen bg-muted/30">
      <div className="p-4 flex items-center justify-between print:hidden">
        <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadPdf} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button onClick={()=> window.print()}>Print</Button>
        </div>
      </div>

      <div
        id="print-root"
        ref={sheetRef}
        className="doc relative mx-auto bg-white shadow print:shadow-none"
        style={{
          // Set by useFitToPage; 1 unless the document only just overflows.
          transform: `scale(${fitScale})`,
          transformOrigin: 'top center',
          width: '210mm',
          minHeight: '297mm',
          // The document's brand colour comes from Company Settings; this used
          // to be a hardcoded purple, so the setting had no visible effect.
          ['--brand' as string]: c.primaryColor || '#128768',
          ['--brand-2' as string]: c.secondaryColor || '#1BA37E',
        }}
      >
        {/* Watermark */}
        {c.logoDataUrl && (
          <img src={c.logoDataUrl} aria-hidden className="pointer-events-none select-none opacity-[0.035] absolute -right-16 -bottom-10 w-[300mm] max-w-none -z-10" />
        )}
        {/* Document padding wrapper */}
        <div className="doc__body relative z-10 m-2 flex flex-col border-2 border-[color:var(--brand)]">
          {/* Top colored edge */}
          <div className="h-1.5 shrink-0 bg-gradient-to-r from-[color:var(--brand)] to-[color:var(--brand-2)]"></div>
          
          {/* Main content with colored edges */}
          <div className="flex flex-1 flex-col">
            {/* Clean Header with Logo */}
            <div className="bg-white border-b border-gray-200">
              <div className="px-7 py-3 flex items-start justify-between">
                <div className="flex-1">
                  {c.logoDataUrl && (
                    <div className="mb-2 inline-block rounded bg-white p-1">
                      <img src={c.logoDataUrl} className="h-14 w-auto max-w-[200px] object-contain" />
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    <div className="mt-2">
                      <div className="text-xs font-bold">Quotation No:</div>
                      <div className="text-sm font-semibold">{q.number}</div>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold">Date:</div>
                      <div className="text-sm font-semibold">{new Date(q.createdAt).toLocaleDateString('en-GB')}</div>
                    </div>
                    {q.expiryDate && (
                      <div className="mt-2">
                        <div className="text-xs font-bold">Valid Until:</div>
                        <div className="text-sm font-semibold">{new Date(q.expiryDate).toLocaleDateString('en-GB')}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-6 text-right">
                  <div className="text-2xl font-bold leading-none text-gray-900">QUOTATION</div>
                  {/* From Company Settings; these were hardcoded to one company. */}
                  <div className="mt-1.5 text-[11px] leading-snug text-gray-600">
                    <div className="text-base font-semibold text-gray-900">{c.name}</div>
                    {c.taxId && <div>Reg/Tax: {c.taxId}</div>}
                    {c.address && <div className="whitespace-pre-line">{c.address}</div>}
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div>{c.phone}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To Section */}
            <div className="px-7 mt-1.5">
              <div className="bg-gradient-to-r from-[color:var(--brand)]/[0.06] to-[color:var(--brand-2)]/[0.06] rounded-lg p-6 border border-[color:var(--brand)]/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Bill To */}
                  <div>
                    <div className="text-[11px] font-semibold text-[color:var(--brand)] uppercase tracking-wide mb-1">Bill To</div>
                    <div className="text-gray-900">
                      <div className="font-semibold text-lg">{q.customer.companyName || q.customer.name}</div>
                      <div className="text-gray-700">{q.customer.name}</div>
                      {q.customer.email && <div className="text-gray-600">{q.customer.email}</div>}
                      {q.customer.responsible?.name && (
                        <div className="mt-1 text-gray-600">Attn: {q.customer.responsible.name}{q.customer.responsible.title ? `, ${q.customer.responsible.title}` : ""}</div>
                      )}
                    </div>
                  </div>
                   
                  {/* Right Column - Address */}
                  {billTo?.addr && (
                    <div>
                      <div className="text-[11px] font-semibold text-[color:var(--brand)] uppercase tracking-wide mb-1">Address</div>
                      <div className="text-gray-600 whitespace-pre-line">
                        {(billTo.addr.line1||"")}
                        {billTo.addr.line2 ? `\n${billTo.addr.line2}` : ""}
                        {billTo.addr.city || billTo.addr.state || billTo.addr.postalCode ? `\n${[billTo.addr.city, billTo.addr.state, billTo.addr.postalCode].filter(Boolean).join(', ')}` : ""}
                        {billTo.addr.country ? `\n${billTo.addr.country}` : ""}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="px-7">
            <div className="rounded border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-[color:var(--brand)] to-[color:var(--brand-2)] text-white">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-semibold" colSpan={2}>Description</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Unit Price</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Quantity</th>
                    <th className="text-right px-3 py-1.5 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {q.items.map((it) => (
                    <tr key={it.id} className="border-b border-gray-100">
                      <td className="px-3 py-1 align-top" colSpan={2}>
                        <div className="text-xs font-medium text-gray-900">{it.name}</div>
                        {it.description && <div className="mt-0.5 text-[11px] leading-snug text-gray-600">{it.description}</div>}
                      </td>
                      <td className="px-3 py-1 text-right align-top text-gray-900">{currency(it.price, c.currencySymbol)}</td>
                      <td className="px-3 py-1 text-right align-top text-gray-900">{it.qty}</td>
                      <td className="px-3 py-1 text-right align-top text-gray-900">{currency(it.qty * it.price, c.currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[color:var(--brand)] bg-gradient-to-r from-[color:var(--brand)] to-[color:var(--brand-2)]">
                    <td className="px-3 py-1.5" colSpan={3}></td>
                    <td className="px-3 py-1.5 text-right text-sm font-extrabold text-white whitespace-nowrap">GRAND TOTAL</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary — mt-auto pins this to the bottom of the sheet. */}
          <div className="doc__footer avoid-break mt-auto px-7 pt-8">
            <div className="text-sm text-gray-600">
              <div className="mb-1.5 font-medium">Thank You For Your Business!</div>
              <div className="mb-4 font-medium">Quotation Terms:</div>
              <div className="text-xs text-gray-600">This quotation is valid until {new Date(q.expiryDate).toLocaleDateString('en-GB')}</div>
              <div className="mt-3">Payment via bank transfer. Please include quotation number as reference.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom colored edge */}
      <div className="h-1.5 shrink-0 bg-gradient-to-r from-[color:var(--brand)] to-[color:var(--brand-2)]"></div>
    </div>
    <style>{a4PrintCss(c.primaryColor || '#128768', c.secondaryColor || '#1BA37E')}</style>
    </>
  );
};

export default QuotationPrint;
