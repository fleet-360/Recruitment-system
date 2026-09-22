"use client";

export default function OfficeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="glass p-8 text-center">
      <h2 className="text-lg font-bold">משהו השתבש</h2>
      <p className="mb-4 text-slate-500">הפעולה לא הושלמה. נסה שוב.</p>
      <button onClick={reset} className="bg-accent-gradient rounded-xl px-6 py-2 text-white">
        נסה שוב
      </button>
    </section>
  );
}
