"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { keepValues } from "@/lib/keep-values";
import { smsSegments } from "@/lib/sms";
import { sendCampaign } from "./actions";

type Props = { segment: Record<string, string | undefined>; recipients: number; footer: string };

// Message + live length/segments (including the removal-link footer, whose token length is fixed) + confirm before sending.
export function SmsForm({ segment, recipients, footer }: Props) {
  const [state, action, pending] = useActionState(sendCampaign, null);

  return (
    <form
      key={state?.savedAt} // a new form (and empty message) after a send
      onSubmit={(e) => {
        const parts = smsSegments(`${String(new FormData(e.currentTarget).get("message")).trim()}${footer}`);
        if (!confirm(`לשלוח SMS ל-${recipients} נמענים? (${parts * recipients} יחידות SMS)`)) return e.preventDefault();
        keepValues(action)(e);
      }}
      className="glass space-y-3 p-4"
    >
      {Object.entries(segment).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <MessageField recipients={recipients} footer={footer} pending={pending} />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.notice && <p className="text-sm text-emerald-700">{state.notice}</p>}
    </form>
  );
}

function MessageField({ recipients, footer, pending }: Omit<Props, "segment"> & { pending: boolean }) {
  const [text, setText] = useState("");
  const full = `${text.trim()}${footer}`;
  const parts = smsSegments(full);

  return (
    <>
      <label className="block text-sm font-medium" htmlFor="sms-message">
        ההודעה
      </label>
      <textarea
        id="sms-message"
        name="message"
        required
        maxLength={500}
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="לדוגמה: נפתחו משרות חדשות באזור המרכז! חזרו אלינו לפרטים"
        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
      />
      <p className="text-xs text-slate-500">
        בסוף כל הודעה יתווסף קישור הסרה אישי. {full.length} תווים · {parts} {parts === 1 ? "יחידה" : "יחידות"} לנמען
      </p>
      <button
        disabled={pending || !recipients || !text.trim()}
        className="bg-accent-gradient flex w-full items-center justify-center gap-2 rounded-xl p-3 font-medium text-white disabled:opacity-60"
      >
        <Send size={18} className="-scale-x-100" /> {pending ? "שולח..." : `שליחה ל-${recipients} נמענים`}
      </button>
    </>
  );
}
