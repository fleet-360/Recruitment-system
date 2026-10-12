import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

// Outside /public on purpose — files are only served by /api/files/[id] after a permission check.
export const uploadRoot = () => path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

// Staging on Vercel has no persistent disk, so CV uploads are switched off there (task 29; storage backend = task 30).
export const uploadsDisabled = () => !!process.env.UPLOADS_DISABLED;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const mimeByExt: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

// Shared by the candidate-card uploader and the quick-intake CV field (task 31) so the rules live in one place.
export function validateUpload(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "הקובץ גדול מ-10MB";
  if (!mimeByExt[path.extname(file.name).toLowerCase()]) return "סוג קובץ לא נתמך (PDF, Word או תמונה)";
  return null;
}

export async function saveCandidateFile(candidateId: string, file: File) {
  const ext = path.extname(file.name).toLowerCase();
  const storagePath = `${candidateId}/${randomUUID()}${ext}`;
  await mkdir(path.join(uploadRoot(), candidateId), { recursive: true });
  await writeFile(path.join(uploadRoot(), storagePath), Buffer.from(await file.arrayBuffer()));
  await db.candidateFile.create({ data: { candidateId, storagePath, filename: file.name } });
}
