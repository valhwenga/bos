/**
 * File storage.
 *
 * Uploads were converted to base64 data URLs and written into localStorage:
 * employee CVs and ID copies, expense receipts, project files, ticket and lead
 * attachments, chat and email attachments, the company logo and signature.
 *
 * That does not work beyond a demo. Base64 inflates a file by about a third and
 * the whole origin is capped near 5MB, so a few scanned IDs exhaust it — and
 * the failure is ugly either way: some stores call setItem with no try/catch
 * and throw QuotaExceededError, losing the save; others swallow the error, so
 * the upload silently disappears and the user believes it worked.
 *
 * Files belong in the storage buckets created by the file_storage migration,
 * with the database holding a path. Until the stores are wired to Postgres this
 * module keeps the localStorage path working, but refuses uploads that would
 * damage the store rather than letting them corrupt it.
 */

/** Mirrors bucket_module() in the file_storage migration. */
export type StorageBucket =
  | "employee-documents"
  | "expense-receipts"
  | "project-files"
  | "ticket-attachments"
  | "lead-attachments"
  | "message-attachments"
  | "company-assets";

/** Matches the file_size_limit set on each bucket. */
export const BUCKET_LIMITS: Record<StorageBucket, number> = {
  "employee-documents": 10 * 1024 * 1024,
  "expense-receipts": 5 * 1024 * 1024,
  "project-files": 25 * 1024 * 1024,
  "ticket-attachments": 10 * 1024 * 1024,
  "lead-attachments": 10 * 1024 * 1024,
  "message-attachments": 10 * 1024 * 1024,
  "company-assets": 2 * 1024 * 1024,
};

/**
 * What a browser origin realistically gets. The spec says nothing, but ~5MB is
 * the common ceiling and the one this app has to live within today.
 */
const LOCAL_QUOTA_BYTES = 5 * 1024 * 1024;

/**
 * Ceiling for a single file while still on localStorage. Deliberately far
 * below the bucket limits: a 10MB CV is fine in object storage and fatal here.
 * Base64 costs about a third on top, so 600KB of file is roughly 800KB stored.
 */
const LOCAL_MAX_FILE_BYTES = 600 * 1024;

/** Leaves room for the records themselves, not just their attachments. */
const LOCAL_SAFE_CEILING = LOCAL_QUOTA_BYTES * 0.8;

export type StoredFile = {
  bucket: StorageBucket;
  /** Path within the bucket once uploaded; empty while still inline. */
  path: string;
  name: string;
  type: string;
  size: number;
  /** Populated only on the localStorage path. */
  dataUrl?: string;
};

export class FileTooLargeError extends Error {
  constructor(readonly fileName: string, readonly size: number, readonly limit: number) {
    super(
      `"${fileName}" is ${formatBytes(size)}. The current limit is ${formatBytes(limit)} ` +
        `because files are still held in browser storage. Connecting the database lifts this.`,
    );
    this.name = "FileTooLargeError";
  }
}

export class StorageFullError extends Error {
  constructor(readonly usedBytes: number) {
    super(
      `Browser storage is nearly full (${formatBytes(usedBytes)} used). ` +
        `Remove some attachments, or connect the database so files are stored outside the browser.`,
    );
    this.name = "StorageFullError";
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Rough bytes currently held in localStorage for this origin. */
export function usedStorageBytes(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  } catch {
    /* storage unavailable */
  }
  return total;
}

export function storagePressure(): { usedBytes: number; ratio: number; nearlyFull: boolean } {
  const usedBytes = usedStorageBytes();
  return {
    usedBytes,
    ratio: usedBytes / LOCAL_QUOTA_BYTES,
    nearlyFull: usedBytes >= LOCAL_SAFE_CEILING,
  };
}

/**
 * Accepts a file for a bucket, throwing a specific, explainable error rather
 * than letting the store blow its quota.
 *
 * Structured so the body can be swapped for a Supabase Storage upload without
 * changing callers: the returned StoredFile already carries bucket and path.
 */
export async function acceptFile(bucket: StorageBucket, file: File): Promise<StoredFile> {
  if (file.size > LOCAL_MAX_FILE_BYTES) {
    throw new FileTooLargeError(file.name, file.size, LOCAL_MAX_FILE_BYTES);
  }

  const pressure = storagePressure();
  // Base64 costs roughly 4/3 of the original.
  const projected = pressure.usedBytes + file.size * 1.37;
  if (projected >= LOCAL_SAFE_CEILING) {
    throw new StorageFullError(pressure.usedBytes);
  }

  const dataUrl = await readAsDataUrl(file);

  return {
    bucket,
    path: "", // set when the file moves to object storage
    name: file.name,
    type: file.type,
    size: file.size,
    dataUrl,
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

/**
 * Writes to localStorage, turning a quota failure into a typed error instead of
 * an unhandled throw or a silently swallowed one.
 */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    const quotaExceeded =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED");
    if (quotaExceeded) throw new StorageFullError(usedStorageBytes());
    throw err;
  }
}
