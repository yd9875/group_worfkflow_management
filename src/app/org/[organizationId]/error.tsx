"use client";

export default function OrganizationError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="card mx-auto mt-16 max-w-lg p-8 text-center">
      <p className="eyebrow">접근할 수 없음</p>
      <h1 className="mt-2 text-2xl font-extrabold">이 화면을 표시하지 못했습니다</h1>
      <p className="muted mt-3 leading-7">권한이 없거나 요청을 처리하는 중 문제가 발생했습니다.</p>
      <button className="btn btn-primary mt-6" onClick={reset}>다시 시도</button>
    </section>
  );
}
