import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AccountingStore, Invoice } from "@/lib/accountingStore";
import { CompanySettingsStore } from "@/lib/companySettings";
import { a4PrintCss } from "@/lib/printStyles";
import { useFitToPage } from "@/lib/useFitToPage";
import { Button } from "@/components/ui/button";
import { PaymentStore } from "@/lib/paymentStore";
import { CreditNotesStore } from "@/lib/creditNotesStore";
import { PDF_COLORS, PDF_CONFIG } from "@/lib/pdfGenerator";

const currency = (v: number, sym: string) => `${sym}${v.toFixed(2)}`;

const InvoicePrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  useEffect(() => {
    const onPayments = () => {
      // Only update if this invoice is affected
      const currentInvoice = AccountingStore.listInvoices().find(i => i.id === id);
      if (currentInvoice) {
        setTick((t)=> t+1);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      // Only update for relevant storage changes
      if ((e.key.startsWith("acct.payments") || e.key.startsWith("acct.invoices")) && e.key.includes(id)) {
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

  const inv = AccountingStore.listInvoices().find(i => i.id === id);
  const c = CompanySettingsStore.get();
  const sheetRef = useRef<HTMLDivElement>(null);
  const fitScale = useFitToPage(sheetRef, [inv]);
  const billTo = useMemo(() => {
    const cust = inv?.customer;
    if (!cust) return undefined;
    const useShip = inv?.useShippingAddress;
    const addr = useShip ? (cust.shippingAddress || cust.billingAddress) : (cust.billingAddress || cust.shippingAddress);
    return { cust, addr };
  }, [inv]);

  const totals = useMemo(() => {
    if (!inv) return { subtotal: 0, discount: 0, shipping: 0, tax: 0, grand: 0 };
    const subtotal = inv.items.reduce((s, it) => s + it.qty * it.price, 0);
    const discount = inv.discountPct ? (subtotal * inv.discountPct) / 100 : 0;
    const shipping = inv.shipping || 0;
    const tax = 0; // customize if you add tax support later
    const grand = subtotal - discount + shipping + tax;
    return { subtotal, discount, shipping, tax, grand };
  }, [inv, tick]);

  const paid = useMemo(() => inv ? PaymentStore.sumAmount(PaymentStore.byInvoice(inv.id)) : 0, [inv, tick]);
  const credits = useMemo(() => inv ? CreditNotesStore.sumAppliedToInvoice(inv.id) : 0, [inv, tick]);
  const balance = Math.max(0, (totals.grand || 0) - (paid || 0) - (credits || 0));

  if (!inv) return (
    <div className="p-6">
      <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
      <div className="mt-3">Invoice not found.</div>
    </div>
  );

  const downloadPdf = async () => {
    setIsGenerating(true);
    try {
      if (!inv) {
        console.error('No invoice data found');
        return;
      }
    
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        console.error('Could not open print window');
        return;
      }
    
    // Generate proper HTML with inline styles
    const currency = (v: number, sym: string) => `${sym}${v.toFixed(2)}`;
    const subtotal = inv.items.reduce((s, it) => s + it.qty * it.price, 0);
    const discount = inv.discountPct ? (subtotal * inv.discountPct) / 100 : 0;
    const shipping = inv.shipping || 0;
    const grand = subtotal - discount + shipping;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${inv.number || 'invoice'}.pdf</title>
          <style>
            ${a4PrintCss(c.primaryColor || '#128768', c.secondaryColor || '#1BA37E')}
            body { font-family: system-ui, -apple-system, sans-serif; }
            /* The container is the A4 sheet; .doc supplies its sizing and the
               flex column that keeps the footer on the bottom edge. */
            .invoice-container { position: relative; }
            .top-edge {
              height: 6px;
              background: var(--brand);
            }
            .border-container {
              border-left: 4px solid var(--brand);
              border-right: 4px solid var(--brand);
            }
            .header {
              background: white;
              border-bottom: 1px solid #e5e7eb;
              padding: 30px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .header-left {
              flex: 1;
            }
            .header-right {
              margin-left: 24px;
              text-align: right;
            }
            .invoice-title {
              font-size: 28px;
              font-weight: bold;
              color: #111827;
              margin-bottom: 3px;
            }
            .company-name {
              font-size: 18px;
              font-weight: 600;
              color: #111827;
              margin-bottom: 6px;
            }
            .company-details {
              font-size: 12px;
              color: #6b7280;
              line-height: 1.3;
            }
            .invoice-details {
              font-size: 12px;
              color: #6b7280;
              margin-top: 6px;
            }
            .invoice-number {
              font-weight: bold;
              font-size: 14px;
            }
            .logo-container {
              margin-bottom: 12px;
              background: white;
              padding: 16px;
              border-radius: 6px;
              display: inline-block;
            }
            .logo {
              height: 100px;
              width: auto;
              max-width: 280px;
              object-fit: contain;
            }
            .bill-to-section {
              padding: 30px;
            }
            .bill-to-container {
              background: #faf5ff;
              border: 1px solid #e9d5ff;
              border-radius: 6px;
              padding: 18px;
            }
            .section-title {
              font-size: 12px;
              font-weight: 600;
              color: #6d28d9;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 8px;
            }
            .customer-name {
              font-size: 16px;
              font-weight: 600;
              color: #111827;
              margin-bottom: 3px;
            }
            .customer-contact {
              color: #6b7280;
              margin-bottom: 1px;
              font-size: 12px;
            }
            .items-table {
              padding: 0 30px;
            }
            .table-container {
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              overflow: hidden;
            }
            table {
              width: 100%;
              font-size: 12px;
              border-collapse: collapse;
            }
            th {
              background: var(--brand);
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
              font-size: 11px;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #f3f4f6;
              vertical-align: top;
              font-size: 12px;
            }
            .text-right {
              text-align: right;
            }
            .total-row {
              background: var(--brand);
              color: white;
              font-weight: bold;
            }
            .summary-section {
              padding: 30px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
            }
            .banking-details {
              background: #faf5ff;
              border: 1px solid #e9d5ff;
              border-radius: 6px;
              padding: 18px;
            }
            .balance-due {
              background: #faf5ff;
              border: 1px solid #e9d5ff;
              border-radius: 6px;
              padding: 18px;
            }
            .footer {
              padding: 30px;
              font-size: 12px;
              color: #6b7280;
            }
            .watermark {
              position: absolute;
              right: -16px;
              bottom: -10px;
              width: 300mm;
              max-width: none;
              opacity: 0.035;
              pointer-events: none;
              z-index: -10;
            }
          </style>
        </head>
        <body>
          <div class="invoice-container doc">
            ${c.logoDataUrl ? `<img src="${c.logoDataUrl}" class="watermark" alt="Watermark">` : ''}
            <div class="top-edge"></div>
            <div class="border-container doc__body" style="display:flex;flex-direction:column">
              <div class="header">
                <div class="header-left">
                  ${c.logoDataUrl ? `
                    <div class="logo-container">
                      <img src="${c.logoDataUrl}" class="logo" alt="Company Logo">
                    </div>
                  ` : ''}
                  <div class="invoice-details">
                    <div class="invoice-number">Invoice No: ${inv.number}</div>
                    <div>Date: ${new Date(inv.createdAt).toLocaleDateString('en-GB')}</div>
                  </div>
                </div>
                <div class="header-right">
                  <div class="invoice-title">INVOICE</div>
                  <div class="company-name">Spike Technologies</div>
                  <div class="company-details">
                    <div><strong>Company registration:</strong> 2021/847783/07</div>
                    <div><strong>Website:</strong> www.spiketech.co.za</div>
                    <div><strong>Email:</strong> accounts@spiketech.co.za</div>
                    ${c.phone ? `<div><strong>Phone:</strong> ${c.phone}</div>` : ''}
                  </div>
                </div>
              </div>
              
              <div class="bill-to-section">
                <div class="bill-to-container">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                      <div class="section-title">Bill To</div>
                      <div class="customer-name">${inv.customer.companyName || inv.customer.name}</div>
                      <div class="customer-contact">${inv.customer.name}</div>
                      ${inv.customer.email ? `<div class="customer-contact">${inv.customer.email}</div>` : ''}
                      ${inv.customer.responsible?.name ? `<div class="customer-contact">Attn: ${inv.customer.responsible.name}${inv.customer.responsible.title ? `, ${inv.customer.responsible.title}` : ""}</div>` : ''}
                    </div>
                    ${billTo?.addr ? `
                      <div>
                        <div class="section-title">Address</div>
                        <div class="customer-contact">
                          ${billTo.addr.line1 || ""}${billTo.addr.line2 ? `<br>${billTo.addr.line2}` : ""}
                          ${[billTo.addr.city, billTo.addr.state, billTo.addr.postalCode].filter(Boolean).join(', ') ? `<br>${[billTo.addr.city, billTo.addr.state, billTo.addr.postalCode].filter(Boolean).join(', ')}` : ""}
                          ${billTo.addr.country ? `<br>${billTo.addr.country}` : ""}
                        </div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
              
              <div class="items-table">
                <div class="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th colspan="2">Description</th>
                        <th class="text-right">Unit Price</th>
                        <th class="text-right">Quantity</th>
                        <th class="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${inv.items.map(item => `
                        <tr>
                          <td colspan="2">
                            <div style="font-weight: 500; color: #111827;">${item.name}</div>
                            ${item.description ? `<div style="font-size: 10px; color: #6b7280; margin-top: 3px;">${item.description}</div>` : ''}
                          </td>
                          <td class="text-right">${currency(item.price, c.currencySymbol)}</td>
                          <td class="text-right">${item.qty}</td>
                          <td class="text-right">${currency(item.qty * item.price, c.currencySymbol)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                    <tfoot>
                      <tr class="total-row">
                        <td colspan="3"></td>
                        <td class="text-right">GRAND TOTAL</td>
                        <td class="text-right">${currency(grand, c.currencySymbol)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              
              <div class="summary-section">
                <div class="summary-grid">
                  <div class="banking-details">
                    <div style="font-weight: 500; margin-bottom: 6px; font-size: 11px;">Banking Details</div>
                    <div style="font-size: 10px; color: #374151; line-height: 1.3;">
                      ${c.bankName ? `<div>Bank: ${c.bankName}</div>` : ''}
                      ${c.bankAccount ? `<div>Account: ${c.bankAccount}</div>` : ''}
                      ${c.branchCode ? `<div>Branch Code: ${c.branchCode}</div>` : ''}
                      ${c.branchName ? `<div>Branch: ${c.branchName}</div>` : ''}
                      <div>Reference: ${inv.number}</div>
                    </div>
                  </div>
                  <div class="balance-due">
                    <div style="font-weight: 500; margin-bottom: 6px; font-size: 11px;">Balance Due</div>
                    <div style="font-size: 10px; color: #374151; line-height: 1.3;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span>Sub Total</span>
                        <span>${currency(subtotal, c.currencySymbol)}</span>
                      </div>
                      ${discount > 0 ? `
                      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span>Discount (${inv.discountPct}%)</span>
                        <span>-${currency(discount, c.currencySymbol)}</span>
                      </div>
                      ` : ''}
                      ${shipping > 0 ? `
                      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span>Shipping</span>
                        <span>${currency(shipping, c.currencySymbol)}</span>
                      </div>
                      ` : ''}
                      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span>Tax (VAT)</span>
                        <span>${currency(0, c.currencySymbol)}</span>
                      </div>
                      <div style="border-top: 1px solid #e9d5ff; padding-top: 6px; margin-top: 6px;">
                        <div style="display: flex; justify-content: space-between; font-weight: 600;">
                          <span>TOTAL</span>
                          <span>${currency(grand, c.currencySymbol)}</span>
                        </div>
                      </div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span>Deposits</span>
                        <span>${currency(paid, c.currencySymbol)}</span>
                      </div>
                      <div style="border-top: 1px solid #e9d5ff; padding-top: 6px; margin-top: 6px;">
                        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px;">
                          <span>BALANCE DUE</span>
                          <span>${currency(balance, c.currencySymbol)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="footer doc__footer avoid-break" style="margin-top:auto">
                <div style="margin-bottom: 12px; font-weight: 500;">Thank You For Your Business!</div>
                ${c.footerNote ? `
                  <div>
                    <div style="font-weight: 500; margin-bottom: 6px; font-size: 11px;">Terms & Conditions</div>
                    <div style="font-size: 10px; color: #6b7280; white-space: pre-wrap;">${c.footerNote}</div>
                  </div>
                ` : ''}
                <div style="margin-top: 12px;">Payment via bank transfer. Please include the invoice number as reference.</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    
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
        }, 1000);
      }, 500);
    } catch (error) {
      console.error('PDF generation failed:', error);
      // Could add user notification here
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
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
                    <div className="mt-1 flex gap-1.5 text-xs">
                      <span className="font-bold">Invoice No:</span>
                      <span className="font-semibold">{inv.number}</span>
                    </div>
                    <div className="mt-0.5 flex gap-1.5 text-xs">
                      <span className="font-bold">Date:</span>
                      <span className="font-semibold">{new Date(inv.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>
                </div>
                <div className="ml-6 text-right">
                  <div className="text-2xl font-bold leading-none text-gray-900">INVOICE</div>
                  {/* Sourced from Company Settings. These were hardcoded to one
                      company's name, registration, website and email, so every
                      customer's invoice carried the wrong details. */}
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
              <div className="bg-gradient-to-r from-[color:var(--brand)]/[0.06] to-[color:var(--brand-2)]/[0.06] rounded-md p-3 border border-[color:var(--brand)]/20">
                <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
                  {/* Left Column - Bill To */}
                  <div>
                    <div className="text-[11px] font-semibold text-[color:var(--brand)] uppercase tracking-wide mb-1">Bill To</div>
                    <div className="text-gray-900">
                      <div className="font-semibold text-lg">{inv.customer.companyName || inv.customer.name}</div>
                      <div className="text-gray-700">{inv.customer.name}</div>
                      {inv.customer.email && <div className="text-gray-600">{inv.customer.email}</div>}
                      {inv.customer.responsible?.name && (
                        <div className="mt-1 text-gray-600">Attn: {inv.customer.responsible.name}{inv.customer.responsible.title ? `, ${inv.customer.responsible.title}`: ""}</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Right Column - Address */}
                  {billTo?.addr && (
                    <div>
                      <div className="text-[11px] font-semibold text-[color:var(--brand)] uppercase tracking-wide mb-1">Address</div>
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
                  {inv.items.map((it) => (
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
                    <td className="px-3 py-1.5 text-right text-sm font-extrabold text-white">{currency(totals.grand, c.currencySymbol)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary Section */}
            <div className="px-7 mt-1.5">
              <div className="text-xs text-gray-600">
                <div className="mb-1.5 font-medium">Thank You For Your Business!</div>
                {c.footerNote && (
                  <div>
                    <div className="mb-1 font-medium">Terms &amp; Conditions</div>
                    <div className="text-xs text-gray-500 whitespace-pre-wrap">{c.footerNote}</div>
                  </div>
                )}
              </div>
              
              {/* Side by side boxes */}
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Banking Details Box */}
                <div>
                  <div className="bg-gradient-to-r from-[color:var(--brand)]/[0.06] to-[color:var(--brand-2)]/[0.06] rounded-md px-4 py-3 border border-[color:var(--brand)]/20">
                    <div className="mb-1 text-xs font-medium">Banking Details</div>
                    <div className="space-y-0.5 text-[11px] text-gray-700">
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
                  <div className="bg-gradient-to-r from-[color:var(--brand)]/[0.06] to-[color:var(--brand-2)]/[0.06] rounded-md px-4 py-3 border border-[color:var(--brand)]/20">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 whitespace-nowrap">Sub Total</span>
                        <span className="font-medium">{currency(totals.subtotal, c.currencySymbol)}</span>
                      </div>
                      {totals.discount > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600 whitespace-nowrap">Discount ({inv.discountPct}%)</span>
                          <span className="font-medium">-{currency(totals.discount, c.currencySymbol)}</span>
                        </div>
                      )}
                      {totals.shipping > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600 whitespace-nowrap">Shipping</span>
                          <span className="font-medium">{currency(totals.shipping, c.currencySymbol)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 whitespace-nowrap">Tax (VAT)</span>
                        <span className="font-medium">{currency(totals.tax, c.currencySymbol)}</span>
                      </div>
                      <div className="border-t border-[color:var(--brand)]/20 pt-2 mt-2">
                        <div className="flex justify-between font-semibold text-gray-900">
                          <span className="whitespace-nowrap">TOTAL</span>
                          <span>{currency(totals.grand, c.currencySymbol)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 whitespace-nowrap">Deposits</span>
                        <span className="font-medium">{currency(paid, c.currencySymbol)}</span>
                      </div>
                      <div className="border-t border-[color:var(--brand)]/20 pt-2 mt-2">
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

          {/* Footer — mt-auto pins this to the bottom of the sheet. */}
          <div className="doc__footer avoid-break mt-auto flex items-center justify-between px-7 pb-2 pt-2 text-xs">
            <div className="text-sm text-slate-500">Payment via bank transfer. Please include the invoice number as reference.</div>
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
          </div>
          
          {/* Bottom colored edge */}
          <div className="h-1.5 shrink-0 bg-gradient-to-r from-[color:var(--brand)] to-[color:var(--brand-2)]"></div>
        </div>
      </div>

      <style>{a4PrintCss(c.primaryColor || '#128768', c.secondaryColor || '#1BA37E')}</style>
    </div>
  );
};

export default InvoicePrint;
