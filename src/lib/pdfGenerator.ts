// PDF Generation Utility
export interface PDFData {
  number: string;
  date: string;
  validUntil?: string;
  customer: {
    name: string;
    companyName?: string;
    email?: string;
    responsible?: {
      name?: string;
      title?: string;
    };
  };
  items: Array<{
    id: string;
    name: string;
    description?: string;
    price: number;
    qty: number;
  }>;
}

export interface CompanySettings {
  name: string;
  logoDataUrl?: string;
  address: string;
  email: string;
  phone?: string;
  currencySymbol: string;
  bankName?: string;
  bankAccount?: string;
  branchCode?: string;
  branchName?: string;
  footerNote?: string;
}

export interface BillToData {
  addr?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

// PDF Configuration Constants
export const PDF_DIMENSIONS = {
  width: '210mm',
  height: '297mm',
  padding: 30,
  logoHeight: '100px',
  logoMaxWidth: '280px',
  topEdgeHeight: '6px',
  borderRadius: '6px'
} as const;

export const PDF_COLORS = {
  primary: '#5F33FF',
  secondary: '#7A60D9',
  background: '#faf5ff',
  border: '#e9d5ff',
  text: '#111827',
  muted: '#6b7280',
  light: '#f3f4f6'
} as const;

export const PDF_CONFIG = {
  scale: 2,
  backgroundColor: '#ffffff',
  pageFormat: 'a4',
  printDelay: 500,
  windowCloseDelay: 1000
} as const;

// Currency formatter
export const currency = (v: number, sym: string) => `${sym}${v.toFixed(2)}`;

// Generate HTML template for PDF
export const generatePDFHTML = (
  type: 'invoice' | 'quotation',
  data: PDFData,
  company: CompanySettings,
  billTo?: BillToData,
  totals?: { subtotal: number; tax: number; grand: number; paid?: number; balance?: number }
) => {
  const { subtotal = 0, tax = 0, grand = 0, paid = 0, balance = 0 } = totals || {};
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${data.number || type}.pdf</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, sans-serif;
            background: white;
            width: ${PDF_DIMENSIONS.width};
            min-height: ${PDF_DIMENSIONS.height};
            -webkit-print-color-adjust: exact;
          }
          .invoice-container {
            width: ${PDF_DIMENSIONS.width};
            min-height: ${PDF_DIMENSIONS.height};
            background: white;
            overflow: hidden;
            position: relative;
          }
          .top-edge {
            height: ${PDF_DIMENSIONS.topEdgeHeight};
            background: ${PDF_COLORS.primary};
          }
          .border-container {
            border-left: 4px solid ${PDF_COLORS.primary};
            border-right: 4px solid ${PDF_COLORS.primary};
          }
          .header {
            background: white;
            border-bottom: 1px solid ${PDF_COLORS.light};
            padding: ${PDF_DIMENSIONS.padding}px;
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
            color: ${PDF_COLORS.text};
            margin-bottom: 3px;
          }
          .company-name {
            font-size: 18px;
            font-weight: 600;
            color: ${PDF_COLORS.text};
            margin-bottom: 6px;
          }
          .company-details {
            font-size: 12px;
            color: ${PDF_COLORS.muted};
            line-height: 1.3;
          }
          .invoice-details {
            font-size: 12px;
            color: ${PDF_COLORS.muted};
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
            border-radius: ${PDF_DIMENSIONS.borderRadius};
            display: inline-block;
          }
          .logo {
            height: ${PDF_DIMENSIONS.logoHeight};
            width: auto;
            max-width: ${PDF_DIMENSIONS.logoMaxWidth};
            object-fit: contain;
          }
          .bill-to-section {
            padding: ${PDF_DIMENSIONS.padding}px;
          }
          .bill-to-container {
            background: ${PDF_COLORS.background};
            border: 1px solid ${PDF_COLORS.border};
            border-radius: ${PDF_DIMENSIONS.borderRadius};
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
            color: ${PDF_COLORS.text};
            margin-bottom: 3px;
          }
          .customer-contact {
            color: ${PDF_COLORS.muted};
            margin-bottom: 1px;
            font-size: 12px;
          }
          .items-table {
            padding: 0 ${PDF_DIMENSIONS.padding}px;
          }
          .table-container {
            border: 1px solid ${PDF_COLORS.light};
            border-radius: ${PDF_DIMENSIONS.borderRadius};
            overflow: hidden;
          }
          table {
            width: 100%;
            font-size: 12px;
            border-collapse: collapse;
          }
          th {
            background: ${PDF_COLORS.primary};
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 11px;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid ${PDF_COLORS.light};
            vertical-align: top;
            font-size: 12px;
          }
          .text-right {
            text-align: right;
          }
          .total-row {
            background: ${PDF_COLORS.primary};
            color: white;
            font-weight: bold;
          }
          .summary-section {
            padding: ${PDF_DIMENSIONS.padding}px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
          }
          .banking-details {
            background: ${PDF_COLORS.background};
            border: 1px solid ${PDF_COLORS.border};
            border-radius: ${PDF_DIMENSIONS.borderRadius};
            padding: 18px;
          }
          .balance-due {
            background: ${PDF_COLORS.background};
            border: 1px solid ${PDF_COLORS.border};
            border-radius: ${PDF_DIMENSIONS.borderRadius};
            padding: 18px;
          }
          .footer {
            padding: ${PDF_DIMENSIONS.padding}px;
            font-size: 12px;
            color: ${PDF_COLORS.muted};
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
        <div class="invoice-container">
          ${company.logoDataUrl ? `<img src="${company.logoDataUrl}" class="watermark" alt="Watermark">` : ''}
          <div class="top-edge"></div>
          <div class="border-container">
            <div class="header">
              <div class="header-left">
                ${company.logoDataUrl ? `
                  <div class="logo-container">
                    <img src="${company.logoDataUrl}" class="logo" alt="Company Logo">
                  </div>
                ` : ''}
                <div class="invoice-details">
                  <div class="invoice-number">${type === 'invoice' ? 'Invoice' : 'Quotation'} No: ${data.number}</div>
                  <div>Date: ${new Date(data.date).toLocaleDateString('en-GB')}</div>
                  ${data.validUntil ? `<div>Valid Until: ${new Date(data.validUntil).toLocaleDateString('en-GB')}</div>` : ''}
                </div>
              </div>
              <div class="header-right">
                <div class="invoice-title">${type === 'invoice' ? 'INVOICE' : 'QUOTATION'}</div>
                <div class="company-name">${company.name}</div>
                <div class="company-details">
                  <div><strong>Company registration:</strong> 2021/847783/07</div>
                  <div><strong>Website:</strong> www.spiketech.co.za</div>
                  <div><strong>Email:</strong> ${company.email}</div>
                  ${company.phone ? `<div><strong>Phone:</strong> ${company.phone}</div>` : ''}
                </div>
              </div>
            </div>
            
            <div class="bill-to-section">
              <div class="bill-to-container">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                  <div>
                    <div class="section-title">Bill To</div>
                    <div class="customer-name">${data.customer.companyName || data.customer.name}</div>
                    <div class="customer-contact">${data.customer.name}</div>
                    ${data.customer.email ? `<div class="customer-contact">${data.customer.email}</div>` : ''}
                    ${data.customer.responsible?.name ? `<div class="customer-contact">Attn: ${data.customer.responsible.name}${data.customer.responsible.title ? `, ${data.customer.responsible.title}` : ""}</div>` : ''}
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
                    ${data.items.map(item => `
                      <tr>
                        <td colspan="2">
                          <div style="font-weight: 500; color: ${PDF_COLORS.text};">${item.name}</div>
                          ${item.description ? `<div style="font-size: 10px; color: ${PDF_COLORS.muted}; margin-top: 3px;">${item.description}</div>` : ''}
                        </td>
                        <td class="text-right">${currency(item.price, company.currencySymbol)}</td>
                        <td class="text-right">${item.qty}</td>
                        <td class="text-right">${currency(item.qty * item.price, company.currencySymbol)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                  <tfoot>
                    <tr class="total-row">
                      <td colspan="3"></td>
                      <td class="text-right">GRAND TOTAL</td>
                      <td class="text-right">${currency(grand, company.currencySymbol)}</td>
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
                    ${company.bankName ? `<div>Bank: ${company.bankName}</div>` : ''}
                    ${company.bankAccount ? `<div>Account: ${company.bankAccount}</div>` : ''}
                    ${company.branchCode ? `<div>Branch Code: ${company.branchCode}</div>` : ''}
                    ${company.branchName ? `<div>Branch: ${company.branchName}</div>` : ''}
                    <div>Reference: ${data.number}</div>
                  </div>
                </div>
                <div class="balance-due">
                  <div style="font-weight: 500; margin-bottom: 6px; font-size: 11px;">${type === 'invoice' ? 'Balance Due' : 'Quotation Total'}</div>
                  <div style="font-size: 10px; color: #374151; line-height: 1.3;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                      <span>Sub Total</span>
                      <span>${currency(subtotal, company.currencySymbol)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                      <span>Tax (VAT)</span>
                      <span>${currency(tax, company.currencySymbol)}</span>
                    </div>
                    <div style="border-top: 1px solid ${PDF_COLORS.border}; padding-top: 6px; margin-top: 6px;">
                      <div style="display: flex; justify-content: space-between; font-weight: 600;">
                        <span>TOTAL</span>
                        <span>${currency(grand, company.currencySymbol)}</span>
                      </div>
                    </div>
                    ${type === 'invoice' ? `
                      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span>Deposits</span>
                        <span>${currency(paid, company.currencySymbol)}</span>
                      </div>
                      <div style="border-top: 1px solid ${PDF_COLORS.border}; padding-top: 6px; margin-top: 6px;">
                        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px;">
                          <span>BALANCE DUE</span>
                          <span>${currency(balance, company.currencySymbol)}</span>
                        </div>
                      </div>
                    ` : `
                      <div style="border-top: 1px solid ${PDF_COLORS.border}; padding-top: 6px; margin-top: 6px;">
                        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px;">
                          <span>${type.toUpperCase()} TOTAL</span>
                          <span>${currency(grand, company.currencySymbol)}</span>
                        </div>
                      </div>
                    `}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div style="margin-bottom: 12px; font-weight: 500;">Thank You For Your Business!</div>
              ${company.footerNote ? `
                <div>
                  <div style="font-weight: 500; margin-bottom: 6px; font-size: 11px;">Terms & Conditions</div>
                  <div style="font-size: 10px; color: ${PDF_COLORS.muted}; white-space: pre-wrap;">${company.footerNote}</div>
                </div>
              ` : ''}
              ${data.validUntil ? `
                <div style="margin-bottom: 6px; font-weight: 500;">Quotation Terms:</div>
                <div style="font-size: 10px; color: ${PDF_COLORS.muted};">This quotation is valid until ${new Date(data.validUntil).toLocaleDateString('en-GB')}</div>
              ` : ''}
              <div style="margin-top: 12px;">Payment via bank transfer. Please include ${type} number as reference.</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

// Main PDF generation function
export const generatePDF = (
  type: 'invoice' | 'quotation',
  data: PDFData,
  company: CompanySettings,
  billTo?: BillToData,
  totals?: { subtotal: number; tax: number; grand: number; paid?: number; balance?: number }
) => {
  try {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Could not open print window');
      return false;
    }

    // Generate HTML content
    const htmlContent = generatePDFHTML(type, data, company, billTo, totals);
    
    // Write content to new window
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
    
    return true;
  } catch (error) {
    console.error('PDF generation failed:', error);
    alert('Failed to generate PDF. Please try again.');
    return false;
  }
};
