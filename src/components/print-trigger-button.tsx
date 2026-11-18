'use client';

import { Printer } from 'lucide-react';

export function PrintTriggerButton({ label = 'Print / Save Official PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md bg-[#2a1418] hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white border border-[#d0b074]/40 cursor-pointer transition print:hidden"
    >
      <Printer className="h-3.5 w-3.5 text-[#d0b074]" />
      {label}
    </button>
  );
}
