/**
 * Document numbering for invoices, quotations, credit notes and sales.
 *
 * These numbers used to be generated inline in seven places as
 *   `INV-${year}-${Math.floor(Math.random() * 9000 + 1000)}`
 * which is neither unique nor sequential. Two documents could draw the same
 * number, and tax authorities generally require issued invoices to run in an
 * unbroken sequence.
 *
 * The counters live in localStorage for now. The shape of this module
 * intentionally mirrors the SQL functions added in the document_numbering
 * migration (next_document_number / reserve_document_number), so when the
 * stores move onto Postgres only the bodies here change — the call sites do
 * not.
 */

export type DocumentType = "invoice" | "quotation" | "credit_note" | "sale";

type SequenceConfig = { prefix: string; includeYear: boolean; padding: number };

/** Must stay in step with the seeded rows in public.document_sequences. */
const CONFIG: Record<DocumentType, SequenceConfig> = {
  invoice: { prefix: "INV-", includeYear: true, padding: 4 },
  quotation: { prefix: "Q-", includeYear: true, padding: 4 },
  credit_note: { prefix: "CN-", includeYear: true, padding: 4 },
  sale: { prefix: "S-", includeYear: true, padding: 4 },
};

type Counter = { year: number; next: number };

const KEY = "acct.sequences";

const readAll = (): Partial<Record<DocumentType, Counter>> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};

const writeAll = (all: Partial<Record<DocumentType, Counter>>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full or unavailable; the caller still gets a number */
  }
};

const currentYear = () => new Date().getFullYear();

const format = (type: DocumentType, value: number) => {
  const { prefix, includeYear, padding } = CONFIG[type];
  const year = includeYear ? `${currentYear()}-` : "";
  return `${prefix}${year}${String(value).padStart(padding, "0")}`;
};

/** Counter for a type, restarted when the year rolls over. */
const counterFor = (type: DocumentType): Counter => {
  const stored = readAll()[type];
  const year = currentYear();
  if (!stored || (CONFIG[type].includeYear && stored.year !== year)) {
    return { year, next: 1 };
  }
  return stored;
};

/**
 * The number a document *would* get, without consuming it.
 *
 * Use this to fill the form when a dialog opens. Allocating there would burn a
 * number every time someone opened the form and cancelled, putting a gap in the
 * sequence.
 */
export function previewNextNumber(type: DocumentType): string {
  return format(type, counterFor(type).next);
}

/**
 * Consumes and returns the next number. Call this at the point the document is
 * actually saved.
 */
export function allocateNumber(type: DocumentType): string {
  const counter = counterFor(type);
  const all = readAll();
  all[type] = { year: counter.year, next: counter.next + 1 };
  writeAll(all);
  return format(type, counter.next);
}

/**
 * Advances the counter past a number that has already been used — a
 * hand-entered number, or one carried in from an import — so the next
 * allocation cannot collide with it.
 */
export function reserveNumber(type: DocumentType, used: string): void {
  const trailing = used.match(/(\d+)\s*$/);
  if (!trailing) return;
  const value = parseInt(trailing[1], 10);
  if (!Number.isFinite(value)) return;

  const counter = counterFor(type);
  if (value < counter.next) return;

  const all = readAll();
  all[type] = { year: counter.year, next: value + 1 };
  writeAll(all);
}

/**
 * Resolves the number to save: the allocated one when the field is untouched,
 * otherwise the user's own value, with the counter advanced past it.
 */
export function resolveNumberOnSave(type: DocumentType, entered: string, preview: string): string {
  const trimmed = entered.trim();
  if (!trimmed || trimmed === preview) return allocateNumber(type);
  reserveNumber(type, trimmed);
  return trimmed;
}
