export default function Loading() {
  return (
    <div className="global-loading" role="status" aria-live="polite" aria-label="페이지 불러오는 중">
      <span className="global-loading-spinner" />
      <span className="sr-only">페이지를 불러오는 중입니다.</span>
    </div>
  );
}
