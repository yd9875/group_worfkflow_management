"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button className="btn btn-primary" type="button" onClick={() => window.print()}>
      <Printer size={17} /> 인쇄 / PDF 저장
    </button>
  );
}
