export function NumberBadge({ number }: { number: string }) {
  return (
    <div className="absolute -left-1.75 -top-1.75 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-[#4669a6] bg-[#8caaff] text-[12px] font-semibold text-[#101d42] shadow-[0_0_12px_rgba(107,140,255,.3)]">
      {number}
    </div>
  );
}