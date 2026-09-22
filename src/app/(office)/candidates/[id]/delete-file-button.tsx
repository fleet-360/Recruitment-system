"use client";

import { Trash2 } from "lucide-react";
import { deleteFile } from "../actions";

export function DeleteFileButton({ fileId, filename }: { fileId: string; filename: string }) {
  return (
    <form
      action={deleteFile.bind(null, fileId)}
      onSubmit={(e) => {
        if (!confirm(`למחוק את הקובץ "${filename}"?\nלא ניתן לשחזר את הקובץ לאחר המחיקה.`)) e.preventDefault();
      }}
    >
      <button title="מחיקת קובץ" aria-label={`מחיקת ${filename}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500">
        <Trash2 size={16} />
      </button>
    </form>
  );
}
