import path from "node:path";

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
