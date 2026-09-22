"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { uploadFile } from "../actions";

export function FileUpload({ candidateId }: { candidateId: string }) {
  const [state, action, pending] = useActionState(uploadFile.bind(null, candidateId), null);

  return (
    <form action={action} className="space-y-2">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-3 text-sm text-slate-500 hover:bg-white/60">
        <Upload size={16} />
        {pending ? "מעלה…" : "העלאת קו״ח (PDF, Word או תמונה, עד 10MB)"}
        <input
          type="file"
          name="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="sr-only"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
