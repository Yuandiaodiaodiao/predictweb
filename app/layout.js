import './globals.css';

export const metadata = {
  title: 'Predict.fun 交易平台',
  description: 'Predict.fun 预测市场交易平台',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Neumorphism Design System Fonts */}
        {/* Plus Jakarta Sans - Display font for headlines */}
        {/* DM Sans - Body font for UI elements */}
        {/* JetBrains Mono - Monospace for code/numbers */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
