import "./style.css";
export const metadata = {
  title: "小张养成计划 · 白手起家",
  description: "两个人的冬日养成手记",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
