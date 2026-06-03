import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '史迹 · 中国历史人物关系图谱',
  description: '探索中国历史人物关系、朝代事件与权力网络',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
