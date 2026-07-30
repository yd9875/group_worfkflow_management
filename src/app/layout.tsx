import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "조직 일정 관리",
    template: "%s | 조직 일정 관리",
  },
  description: "조직·부서·개인 일정을 한눈에 관리하는 업무용 일정표",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
