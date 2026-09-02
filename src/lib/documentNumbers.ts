/**
 * Document numbering for invoices, quotations, credit notes and sales.
 *
 * These numbers used to be generated inline in seven places as
 *   `INV-${year}-${Math.floor(Math.random() * 9000 + 1000)}`
 * which is neither unique nor sequential. Two documents could draw the same
 * number, and tax authorities generally require issued invoices to run in an
 * unbroken sequence.
 *
 * The counters live in Postgres, not the browser. That matters now that the
 * documents themselves are shared: with a counter per browser, two people
 * raising an invoice at the same time would both be handed INV-2026-0007, and
 * duplicate invoice numbers are not something SARS accepts.
 *
 * next_document_number() takes a row lock on the counter, so concurrent callers
 * queue rather than collide. A deliberate consequence is that allocation is a
 * round trip — these functions are async, and callers allocate on save, never
 * on opening a dialog.
 */

import { supabase } from "./supabase";

export type DocumentType = "invoice" | "quotation" | "credit_note" | "sale";

type SequenceConfig = { prefix: string; includeYear: boolean; padding: number };

/** Must stay in step with the seeded rows in public.document_sequences. */
const CONFIG: Record<DocumentType, SequenceConfig> = {
  invoice: { prefix: "INV-", includeYear: true, padding: 4 },
  quotation: { prefix: "Q-", includeYear: true, padding: 4 },
  credit_note: { prefix: "CN-", includeYear: true, padding: 4 },
  sale: { prefix: "S-", includeYear: true, padding: 4 },
};

const currentYear = () => new Date().getFullYear();

const format = (type: DocumentType, value: number) => {
  const { prefix, includeYear, padding } = CONFIG[type];
  const year = includeYear ? `${currentYear()}-` : "";
  return `${prefix}${year}${String(value).padStart(padding, "0")}`;
};

/**
 * The number a document *would* get, without consuming it.
 *
 * Use this to fill the form when a dialog opens. Allocating there would burn a
 * number every time someone opened the form and cancelled, putting a gap in the
 * sequence.
 */
export async function previewNextNumber(type: DocumentType): Promise<string> {
  // Deliberately not next_document_number(): that one consumes a number, so
  // using it to fill a form would burn one every time somebody opened a dialog
  // and cancelled, leaving gaps in a series that is supposed to be unbroken.
  // The counter row is readable, so the preview is formatted from it instead.
  const { data, error } = await supabase
    .from("document_sequences")
    .select("prefix, include_year, padding, next_number, current_year")
    .eq("doc_type", type)
    .maybeSingle();

  if (error || !data) return format(type, 1);

  const year = currentYear();
  // A new year restarts the series, which the counter only records once the
  // first number of that year is actually allocated.
  const next = data.include_year && data.current_year !== year ? 1 : data.next_number;
  const yearPart = data.include_year ? `${year}-` : "";
  return `${data.prefix}${yearPart}${String(next).padStart(data.padding, "0")}`;
}

/**
 * Consumes and returns the next number. Call this at the point the document is
 * actually saved.
 */
export async function allocateNumber(type: DocumentType): Promise<string> {
  const { data, error } = await supabase.rpc("next_document_number", { p_doc_type: type });
  if (error || !data) {
    throw new Error(
      `Could not allocate a ${type} number: ${error?.message ?? "no number returned"}`,
    );
  }
  return data as string;
}

/**
 * Advances the counter past a number that has already been used — a
 * hand-entered number, or one carried in from an import — so the next
 * allocation cannot collide with it.
 */
export async function reserveNumber(type: DocumentType, used: string): Promise<void> {
  const trailing = used.match(/(\d+)\s*$/);
  if (!trailing) return;
  const value = parseInt(trailing[1], 10);
  if (!Number.isFinite(value)) return;

  const { error } = await supabase.rpc("reserve_document_number", {
    p_doc_type: type,
    p_used: value,
  });
  if (error) throw new Error(error.message);
}

/**
 * Resolves the number to save: the allocated one when the field is untouched,
 * otherwise the user's own value, with the counter advanced past it.
 */
export async function resolveNumberOnSave(
  type: DocumentType,
  entered: string,
  preview: string,
): Promise<string> {
  const trimmed = entered.trim();
  if (!trimmed || trimmed === preview) return allocateNumber(type);
  await reserveNumber(type, trimmed);
  return trimmed;
}
