/**
 * Files in object storage, with a row in `attachments` recording where each one
 * lives and what it belongs to.
 *
 * Attachments used to be base64 data URLs inside localStorage. Base64 inflates
 * a file by about a third and the whole store is capped near 5MB, so a couple
 * of scanned ID documents filled it — and when it filled, some stores threw
 * while others swallowed the error, so an upload could simply vanish.
 *
 * Buckets are private. A file is readable exactly when its module is, because
 * the storage policies call the same has_access() as the tables.
 */

import { supabase } from "./supabase";

export type StoredFile = {
  id: string;
  bucketId: string;
  storagePath: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  /** What it belongs to, e.g. an employee's id. */
  ownerId?: string;
  ownerTable?: string;
  /** Distinguishes a CV from an ID copy. */
  purpose?: string;
  uploadedAt: string;
};

type AttachmentRow = {
  id: string;
  bucket_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  owner_table: string | null;
  owner_id: string | null;
  purpose: string | null;
  created_at: string;
};

const toStoredFile = (row: AttachmentRow): StoredFile => ({
  id: row.id,
  bucketId: row.bucket_id,
  storagePath: row.storage_path,
  fileName: row.file_name,
  mimeType: row.mime_type ?? undefined,
  sizeBytes: row.size_bytes ?? undefined,
  ownerTable: row.owner_table ?? undefined,
  ownerId: row.owner_id ?? undefined,
  purpose: row.purpose ?? undefined,
  uploadedAt: row.created_at,
});

const ATTACHMENT_COLUMNS =
  "id, bucket_id, storage_path, file_name, mime_type, size_bytes, owner_table, owner_id, purpose, created_at";

/**
 * A storage path that cannot collide and cannot be guessed from the file name.
 *
 * Prefixed by the owner so everything for one record sits together, which makes
 * deleting an employee's files a prefix operation rather than a search.
 */
function storagePath(ownerId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
  return `${ownerId}/${crypto.randomUUID()}-${safe}`;
}

export const FileVault = {
  /**
   * Uploads a file and records it.
   *
   * The storage upload happens first: if the row were written first and the
   * upload then failed, the app would list a document that does not exist.
   * If the row fails, the uploaded object is removed so nothing is orphaned.
   */
  async upload(params: {
    bucketId: string;
    file: File;
    ownerTable?: string;
    ownerId: string;
    purpose?: string;
  }): Promise<StoredFile> {
    const { bucketId, file, ownerTable, ownerId, purpose } = params;
    const path = storagePath(ownerId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(bucketId)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) {
      // Storage enforces the bucket's size and type limits, so this is where an
      // oversized or disallowed file is refused — with a reason, rather than by
      // blowing a quota and taking unrelated data with it.
      throw new Error(uploadError.message);
    }

    const { data, error } = await supabase
      .from("attachments")
      .insert({
        bucket_id: bucketId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        owner_table: ownerTable ?? null,
        owner_id: ownerId,
        purpose: purpose ?? null,
      })
      .select(ATTACHMENT_COLUMNS)
      .single();

    if (error) {
      await supabase.storage.from(bucketId).remove([path]);
      throw new Error(error.message);
    }
    return toStoredFile(data as AttachmentRow);
  },

  async listFor(ownerTable: string, ownerId: string): Promise<StoredFile[]> {
    const { data, error } = await supabase
      .from("attachments")
      .select(ATTACHMENT_COLUMNS)
      .eq("owner_table", ownerTable)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as AttachmentRow[]).map(toStoredFile);
  },

  /**
   * A time-limited link to a private file.
   *
   * The buckets are not public, so there is no permanent URL to store — which
   * is the point: a link that leaked would otherwise expose an ID document
   * indefinitely.
   */
  async signedUrl(file: StoredFile, expiresInSeconds = 300): Promise<string> {
    const { data, error } = await supabase.storage
      .from(file.bucketId)
      .createSignedUrl(file.storagePath, expiresInSeconds);
    if (error || !data) throw new Error(error?.message ?? "Could not create a link to the file.");
    return data.signedUrl;
  },

  /** Removes the record and the stored object. */
  async remove(file: StoredFile): Promise<void> {
    const { error } = await supabase.from("attachments").delete().eq("id", file.id);
    if (error) throw new Error(error.message);
    // The row is the index; if this fails the object is orphaned but
    // unreachable, which is better than a listed file that cannot be opened.
    await supabase.storage.from(file.bucketId).remove([file.storagePath]);
  },
};
