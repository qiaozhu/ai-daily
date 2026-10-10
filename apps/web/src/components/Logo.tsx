/** Logo B (docs/design/assets/brand, copied to public/brand): icon + wordmark, gap ≈ 0.27 × icon size */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center font-bold tracking-[-0.3px]" style={{ gap: Math.round(size * 0.27) }}>
      <img src="/brand/logo-icon.svg" width={size} height={size} alt="" />
      <span className="text-[19px]">AI 热点日报</span>
    </span>
  );
}
