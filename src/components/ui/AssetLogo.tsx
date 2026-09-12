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

  if (type === 'btc') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#8c4e0c] text-[17px] font-bold text-white">
        ₿
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#132d4d] text-[13px] font-semibold text-white">
      {type.slice(0, 2).toUpperCase()}
    </div>
  );
}