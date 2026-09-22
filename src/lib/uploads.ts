import path from "node:path";

// Outside /public on purpose — files are only served by /api/files/[id] after a permission check.
export const uploadRoot = () => path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const mimeByExt: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};
