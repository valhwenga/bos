/**
 * Employee documents.
 *
 * Files live in the private `employee-documents` bucket and this keeps the
 * index. They used to be base64 strings in localStorage, which meant a scanned
 * ID copy was held in the browser of whoever uploaded it, counted against a
 * ~5MB quota, and was gone when that browser was cleared.
 */

import { FileVault, type StoredFile } from "./fileVault";
import { employeeUuid } from "./hrmRepo";

export type DocumentCategory = "contract" | "id" | "visa" | "tax" | "other";

export type EmployeeDocument = {
  id: string;
  employeeId: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
  category: DocumentCategory;
  description?: string;
  size?: number;
};

const BUCKET = "employee-documents";
const OWNER_TABLE = "employees";

const CATEGORIES: DocumentCategory[] = ["contract", "id", "visa", "tax", "other"];
const toCategory = (purpose?: string): DocumentCategory =>
  CATEGORIES.includes(purpose as DocumentCategory) ? (purpose as DocumentCategory) : "other";

const toDocument = (file: StoredFile, employeeId: string): EmployeeDocument => ({
  id: file.id,
  employeeId,
  fileName: file.fileName,
  fileType: file.mimeType ?? "",
  uploadedAt: file.uploadedAt,
  uploadedBy: "",
  category: toCategory(file.purpose),
  size: file.sizeBytes,
});

export const EmployeeDocumentsStore = {
  async forEmployee(employeeId: string): Promise<EmployeeDocument[]> {
    const uuid = await employeeUuid(employeeId);
    if (!uuid) return [];
    const files = await FileVault.listFor(OWNER_TABLE, uuid);
    return files.map((f) => toDocument(f, employeeId));
  },

  async upload(params: {
    employeeId: string;
    file: File;
    category: DocumentCategory;
  }): Promise<EmployeeDocument> {
    const uuid = await employeeUuid(params.employeeId);
    if (!uuid) {
      throw new Error(`Employee ${params.employeeId} was not found, so the file was not uploaded.`);
    }
    const stored = await FileVault.upload({
      bucketId: BUCKET,
      file: params.file,
      ownerTable: OWNER_TABLE,
      ownerId: uuid,
      purpose: params.category,
    });
    return toDocument(stored, params.employeeId);
  },

  /** A short-lived link, since the bucket is private. */
  async openUrl(doc: EmployeeDocument, employeeId: string): Promise<string> {
    const uuid = await employeeUuid(employeeId);
    if (!uuid) throw new Error("Employee not found.");
    const files = await FileVault.listFor(OWNER_TABLE, uuid);
    const match = files.find((f) => f.id === doc.id);
    if (!match) throw new Error("That document no longer exists.");
    return FileVault.signedUrl(match);
  },

  async remove(doc: EmployeeDocument, employeeId: string): Promise<void> {
    const uuid = await employeeUuid(employeeId);
    if (!uuid) return;
    const files = await FileVault.listFor(OWNER_TABLE, uuid);
    const match = files.find((f) => f.id === doc.id);
    if (!match) return;
    await FileVault.remove(match);
  },
};
