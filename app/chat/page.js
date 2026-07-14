'use client';

import Link from 'next/link';

export default function ChatPage() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: '40px auto',
        padding: 20,
      }}
    >
      <h1>💬 채팅</h1>

      <p
        style={{
          color: '#666',
          marginBottom: 30,
        }}
      >
        진행 중인 협업 채팅을 확인할 수 있습니다.
      </p>

      <div
        style={{
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h3>아직 채팅이 없습니다.</h3>

        <p style={{ color: '#777' }}>
          협업 제안을 수락하면 채팅방이 자동으로 생성됩니다.
        </p>
      </div>

      <div style={{ marginTop: 30 }}>
        <Link href="/">
          홈으로
        </Link>
      </div>
    </main>
  );
}
