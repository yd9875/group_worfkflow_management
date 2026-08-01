export default function Loading() {
  return (
    <main className="global-loading" role="status" aria-live="polite" aria-busy="true" aria-label="페이지 불러오는 중">
      <span className="global-loading-spinner" />
      <span className="sr-only">페이지를 불러오는 중입니다.</span>
    </main>
  );
}
