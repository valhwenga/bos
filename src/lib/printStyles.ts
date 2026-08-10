/**
 * Shared A4 rules for printed documents (invoices, quotations).
 *
 * Both the on-screen preview and the pop-up print window use these, so the two
 * cannot drift. The goals are:
 *
 *  - A page is always a full A4 sheet, whether the document has one line item
 *    or forty. The body grows to fill the sheet so the footer sits at the
 *    bottom edge rather than floating under a short table.
 *  - Long documents paginate instead of being clipped. The container used to
 *    set `overflow: hidden`, which silently cut off everything past the first
 *    page.
 *  - Page margins live inside the document, not on `@page`. With a 210mm-wide
 *    document and a 12mm `@page` margin the content was wider than the
 *    printable area, which pushed every sheet onto a second, near-empty one.
 */

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/** Padding inside the sheet, since `@page` carries no margin. */
export const A4_PADDING_MM = 12;

export function a4PrintCss(brand: string, brand2: string): string {
  return `
    :root {
      --brand: ${brand};
      --brand-2: ${brand2};
    }

    @page {
      size: A4;
      /* Margins are applied inside .doc so the sheet and the document agree
         on their width; a margin here would make 210mm overflow the page. */
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .doc {
      width: ${A4_WIDTH_MM}mm;
      min-height: ${A4_HEIGHT_MM}mm;
      margin: 0 auto;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      /* No overflow:hidden — that clips multi-page documents. */
    }

    /* Grows to fill the sheet, which keeps the footer on the bottom edge. */
    .doc__body {
      flex: 1 1 auto;
    }

    .doc__footer {
      flex: 0 0 auto;
    }

    /* Repeat table headings on every sheet and never split a row. */
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr, .avoid-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    @media print {
      html, body { height: auto; }
      .doc {
        width: ${A4_WIDTH_MM}mm;
        box-shadow: none !important;
      }
      .no-print { display: none !important; }
    }
  `;
}
