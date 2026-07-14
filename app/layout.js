import './globals.css';

export const metadata = {
  title: '광고잇다',
  description: '광고주와 인플루언서를 잇는 플랫폼'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
