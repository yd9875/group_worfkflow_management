export function LoadingOverlay({ label = "처리 중입니다." }: { label?: string }) {
  return (
    <div className="global-loading" role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      <span className="global-loading-spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
