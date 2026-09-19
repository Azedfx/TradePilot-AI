export function AssetLogo({ type }: { type: string }) {
  if (type === 'nvda') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#183b13]">
        <div className="text-[13px] font-black italic text-[#76b900]">◉</div>
      </div>
    );
  }

  if (type === 'tsla') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#591923]">
        <span className="text-[17px] font-bold text-[#ef4050]">T</span>
      </div>
    );
  }

  if (type === 'aapl') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#222831] text-[19px]">
        
      </div>
    );
  }

  if (type === 'msft') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0f3a5c] text-[11px] font-bold text-[#00a4ef]">
        MS
      </div>
    );
  }

  if (type === 'amzn') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#3a2a12] text-[11px] font-bold text-[#ff9900]">
        AZ
      </div>
    );
  }

  if (type === 'meta') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1a2a4a] text-[11px] font-bold text-[#0668E1]">
        ∞
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#132d4d] text-[13px] font-semibold text-white">
      {type.slice(0, 2).toUpperCase()}
    </div>
  );
}