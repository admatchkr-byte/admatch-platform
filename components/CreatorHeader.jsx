'use client';

import Link from 'next/link';

export default function CreatorHeader({
  onLogout,
  unreadCount = 0,
}) {
  function scrollToNotifications() {
    const notificationSection = document.getElementById(
      'creator-notifications'
    );

    notificationSection?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  return (
    <header
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            fontSize: 24,
            fontWeight: 800,
            color: '#111827',
          }}
        >
          광고<span style={{ color: '#6c5ce7' }}>잇다</span>
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={scrollToNotifications}
            aria-label={`읽지 않은 알림 ${unreadCount}건`}
            style={{
              position: 'relative',
              width: 42,
              height: 42,
              border: '1px solid #d1d5db',
              borderRadius: '50%',
              background: '#ffffff',
              cursor: 'pointer',
              fontSize: 19,
            }}
          >
            🔔

            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  minWidth: 20,
                  height: 20,
                  padding: '0 5px',
                  borderRadius: 10,
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            style={{
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#111827',
              padding: '10px 16px',
              borderRadius: 9,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}

