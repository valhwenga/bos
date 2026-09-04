/**
 * The addresses the system may send as.
 *
 * Everything used to go out from the single SMTP_FROM, so a customer who wrote
 * to support@ was answered by billing@ — and their reply then went to billing@,
 * which is not where the support queue is.
 *
 * The list is administrator-maintained and the send function checks against it.
 * That check is the point: a caller that could name its own From header could
 * send as the managing director, or as a customer, from inside the company's
 * own relay. What this module does is let the screens show the choice; it does
 * not grant it.
 */

import { supabase } from "./supabase";
import { createCache } from "./collectionCache";
import type { ModuleKey } from "./modules";

export type SendIdentity = {
  id: string;
  address: string;
  displayName?: string;
  module?: ModuleKey;
  isDefault: boolean;
  active: boolean;
};

async function fetchIdentities(): Promise<SendIdentity[]> {
  const { data, error } = await supabase
    .from("send_identities")
    .select("id, address, display_name, module, is_default, active")
    .order("address");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    address: row.address as string,
    displayName: (row.display_name as string) ?? undefined,
    module: (row.module as ModuleKey) ?? undefined,
    isDefault: Boolean(row.is_default),
    active: Boolean(row.active),
  }));
}

export const sendIdentitiesCache = createCache<SendIdentity>(fetchIdentities);

export const SendIdentities = {
  list(): SendIdentity[] {
    return sendIdentitiesCache.list();
  },
  usable(): SendIdentity[] {
    return this.list().filter((i) => i.active);
  },
  /**
   * What to send as when nothing is chosen.
   *
   * Undefined means "whatever SMTP_FROM is", which is correct and is what the
   * function falls back to. The screens say "the system default" rather than
   * inventing an address to display, because the browser genuinely does not
   * know what it is — the credentials and the address live on the server.
   */
  default(): SendIdentity | undefined {
    return this.usable().find((i) => i.isDefault);
  },
  /** The identity for one of the company's addresses, if it is configured. */
  forAddress(address?: string): SendIdentity | undefined {
    if (!address) return undefined;
    const wanted = address.trim().toLowerCase();
    return this.usable().find((i) => i.address === wanted);
  },

  async upsert(identity: Omit<SendIdentity, "id"> & { id?: string }): Promise<void> {
    const payload = {
      address: identity.address.trim().toLowerCase(),
      display_name: identity.displayName?.trim() || null,
      module: identity.module ?? null,
      is_default: identity.isDefault,
      active: identity.active,
    };
    const { error } = identity.id
      ? await supabase.from("send_identities").update(payload).eq("id", identity.id)
      : await supabase.from("send_identities").insert(payload);
    if (error) throw new Error(error.message);
    await sendIdentitiesCache.refresh();
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("send_identities").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await sendIdentitiesCache.refresh();
  },

  /**
   * Makes one the default, clearing the previous.
   *
   * Two statements rather than one: a partial unique index allows a single
   * default, so setting a new one before clearing the old is rejected.
   */
  async setDefault(id: string): Promise<void> {
    const { error: clearError } = await supabase
      .from("send_identities")
      .update({ is_default: false })
      .eq("is_default", true);
    if (clearError) throw new Error(clearError.message);
    const { error } = await supabase
      .from("send_identities")
      .update({ is_default: true })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await sendIdentitiesCache.refresh();
  },
};
