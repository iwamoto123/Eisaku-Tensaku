import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "英作文添削メーカー｜白谷塾オンライン教室",
  description: "生徒の答案画像から、添削フィードバック資料のPNGを作ります。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
