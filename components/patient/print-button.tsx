"use client";

/** 🔴 Task 40: print the receipt, or save it as a PDF from the same dialog. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-navy-600"
    >
      {label}
    </button>
  );
}
