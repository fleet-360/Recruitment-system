import { Check } from "lucide-react";
import type { Option } from "@/lib/lookups";

// Horizontal status stepper. With `action`, every other step is a button that moves the status there.
export function StatusStepper({
  steps,
  currentId,
  action,
}: {
  steps: Option[];
  currentId: string | null;
  action?: (formData: FormData) => Promise<void>;
}) {
  const current = steps.findIndex((s) => s.id === currentId);

  return (
    <ol className="flex items-start overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        const dot = (
          <span
            className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
              state === "done"
                ? "bg-primary-gradient text-white"
                : state === "current"
                  ? "bg-accent-gradient text-white ring-4 ring-violet-100"
                  : "bg-slate-100 text-slate-400"
            }`}
          >
            {state === "done" ? <Check size={14} /> : i + 1}
          </span>
        );
        return (
          <li key={step.id} className="flex min-w-20 flex-1 flex-col items-center gap-1 text-center text-[11px]">
            {action && state !== "current" ? (
              <form action={action}>
                <input type="hidden" name="statusId" value={step.id} />
                <button title={`העבר ל: ${step.label}`} className="cursor-pointer rounded-full hover:opacity-80">
                  {dot}
                </button>
              </form>
            ) : (
              dot
            )}
            <span className={state === "current" ? "font-bold text-violet-700" : "text-slate-500"}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
