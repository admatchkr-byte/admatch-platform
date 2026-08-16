'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import CreatorHeader from '../../components/CreatorHeader';

const STATUS_LABELS = {
  pending: '응답 대기',
  accepted: '수락됨',
  rejected: '거절됨',
  completed: '협업 완료',
  cancelled: '취소됨',
};

export default function CreatorPage() {
  const [creator, setCreator] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [readingId, setReadingId] = useState(null);
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage('로그인 후 이용할 수 있습니다.');
        setCreator(null);
        setProposals([]);
        setNotifications([]);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, region, category, channel')
        .eq('id', user.id)
        .eq('user_type', 'creator')
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profileData) {
        setMessage(
          '현재 로그인 계정과 연결된 크리에이터 프로필을 찾을 수 없습니다.'
        );
        setCreator(null);
        setProposals([]);
        setNotifications([]);
        return;
      }

      setCreator(profileData);

      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select(
          `
          id,
          advertiser_id,
          creator_id,
          brand_name,
          title,
          message,
          proposed_price,
          desired_date,
          status,
          created_at,
          updated_at
        `
        )
        .eq('creator_id', profileData.id)
        .order('created_at', { ascending: false });

      if (proposalError) {
        throw proposalError;
      }

      setProposals(proposalData || []);

      const {
        data: notificationData,
        error: notificationError,
      } = await supabase
        .from('notifications')
        .select(
          `
          id,
          user_id,
          proposal_id,
          type,
          title,
          message,
          is_read,
          created_at
        `
        )
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (notificationError) {
        throw notificationError;
      }

      setNotifications(notificationData || []);
    } catch (error) {
      console.error(error);

      setMessage(
        error?.message || '크리에이터 대시보드를 불러오지 못했습니다.'
      );

      setCreator(null);
      setProposals([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);
  useEffect(() => {
    if (!creator?.id) return;
  
    const channel = supabase
      .channel(`creator-notifications-${creator.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${creator.id}`,
        },
        (payload) => {
          const newNotification = payload.new;
  
          setNotifications((current) => {
            const alreadyExists = current.some(
              (notification) => notification.id === newNotification.id
            );
  
            if (alreadyExists) {
              return current;
            }
  
            return [newNotification, ...current];
          });
        }
      )
      .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, [creator?.id]);

  async function updateProposalStatus(proposalId, nextStatus) {
    if (!creator) return;

    const actionLabel = nextStatus === 'accepted' ? '수락' : '거절';

    const confirmed = window.confirm(
      `이 협업 제안을 ${actionLabel}하시겠습니까?`
    );

    if (!confirmed) return;

    setUpdatingId(proposalId);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('proposals')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposalId)
        .eq('creator_id', creator.id)
        .eq('status', 'pending')
        .select('id, status')
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        setMessage(
          '이미 처리되었거나 현재 계정에서 변경할 수 없는 제안입니다.'
        );
        return;
      }

      setProposals((current) =>
        current.map((proposal) =>
          proposal.id === proposalId
            ? {
                ...proposal,
                status: nextStatus,
              }
            : proposal
        )
      );

      setMessage(`협업 제안을 ${actionLabel}했습니다.`);
    } catch (error) {
      console.error(error);

      setMessage(
        error?.message || `협업 제안 ${actionLabel} 처리에 실패했습니다.`
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function readNotification(notificationId) {
    const targetNotification = notifications.find(
      (notification) => notification.id === notificationId
    );

    if (!targetNotification || targetNotification.is_read) {
      return;
    }

    setReadingId(notificationId);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
        })
        .eq('id', notificationId)
        .eq('user_id', creator.id)
        .select('id, is_read')
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        setMessage('알림을 읽음 처리할 수 없습니다.');
        return;
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                is_read: true,
              }
            : notification
        )
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error?.message || '알림 읽음 처리에 실패했습니다.'
      );
    } finally {
      setReadingId(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  const pendingCount = proposals.filter(
    (proposal) => proposal.status === 'pending'
  ).length;

  const acceptedCount = proposals.filter(
    (proposal) => proposal.status === 'accepted'
  ).length;

  const completedCount = proposals.filter(
    (proposal) => proposal.status === 'completed'
  ).length;

  if (loading) {
    return (
      <main style={pageStyle}>
       <CreatorHeader
  onLogout={handleLogout}
  unreadCount={unreadNotificationCount}
/>

        <section style={sectionStyle}>
          <div style={emptyStyle}>
            크리에이터 대시보드를 불러오는 중입니다.
          </div>
        </section>
      </main>
    );
  }

  if (!creator) {
    return (
      <main style={pageStyle}>
     <CreatorHeader onLogout={handleLogout} />

        <section style={sectionStyle}>
          <div style={emptyStyle}>
            <p style={{ color: '#dc2626' }}>{message}</p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 10,
                flexWrap: 'wrap',
                marginTop: 16,
              }}
            >
              <Link
                href="/creator-register"
                style={{ textDecoration: 'none' }}
              >
                <button type="button" style={primaryButtonStyle}>
                  프로필 등록하기
                </button>
              </Link>

              <Link href="/login" style={{ textDecoration: 'none' }}>
                <button type="button" style={secondaryButtonStyle}>
                  로그인하기
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
    <CreatorHeader
  onLogout={handleLogout}
  unreadCount={unreadNotificationCount}
/>

      <section style={sectionStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: '#6b7280',
                fontSize: 14,
              }}
            >
              크리에이터 대시보드
            </p>

            <h1
              style={{
                margin: '8px 0 0',
                fontSize: 32,
              }}
            >
              안녕하세요, {creator.name}님 👋
            </h1>

            <p
              style={{
                marginTop: 8,
                color: '#6b7280',
              }}
            >
              협업 제안과 알림을 확인하고 수락 또는 거절할 수 있습니다.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 14,
              }}
            >
              {creator.region && (
                <span style={profileTagStyle}>{creator.region}</span>
              )}

              {creator.category && (
                <span style={profileTagStyle}>{creator.category}</span>
              )}

              {creator.channel && (
                <span style={profileTagStyle}>{creator.channel}</span>
              )}
            </div>
          </div>

          <Link
            href={`/creator/${creator.id}`}
            style={{ textDecoration: 'none' }}
          >
            <button type="button" style={secondaryButtonStyle}>
              내 공개 프로필 보기
            </button>
          </Link>
        </div>

        <div
  id="creator-notifications"
  style={notificationSectionStyle}
>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
              }}
            >
              🔔 알림
            </h2>

            <span
              style={{
                color: '#6c5ce7',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              안 읽음 {unreadNotificationCount}건
            </span>
          </div>

          {notifications.length === 0 ? (
            <p
              style={{
                margin: 0,
                color: '#6b7280',
              }}
            >
              새로운 알림이 없습니다.
            </p>
          ) : (
            <div>
              {notifications.slice(0, 5).map((notification, index) => (
                <div
                key={notification.id}
                onClick={async () => {
                  await readNotification(notification.id);
              
                  if (
                    notification.type === 'chat' &&
                    notification.proposal_id
                  ) {
                    window.location.href = `/workspace/${notification.proposal_id}`;
                  }
                }}
                  style={{
                    padding: '14px 0',
                    borderBottom:
                      index === Math.min(notifications.length, 5) - 1
                        ? 'none'
                        : '1px solid #f0f0f0',
                    cursor: notification.is_read
                      ? 'default'
                      : 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <strong
                        style={{
                          fontSize: 15,
                        }}
                      >
                        {notification.title}
                      </strong>

                      <p
                        style={{
                          margin: '6px 0',
                          color: '#4b5563',
                          lineHeight: 1.6,
                        }}
                      >
                        {notification.message || '-'}
                      </p>

                      <span
                        style={{
                          fontSize: 13,
                          color: '#6b7280',
                        }}
                      >
                        {formatNotificationDate(
                          notification.created_at
                        )}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: notification.is_read
                          ? '#10b981'
                          : '#ef4444',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {readingId === notification.id
                        ? '처리 중...'
                        : notification.is_read
                        ? '✓ 읽음'
                        : '● 안 읽음'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginTop: 32,
          }}
        >
          <StatCard label="전체 제안" value={proposals.length} />
          <StatCard label="응답 대기" value={pendingCount} />
          <StatCard label="수락한 제안" value={acceptedCount} />
          <StatCard label="완료한 협업" value={completedCount} />
        </div>

        {message && (
          <div
            style={{
              marginTop: 24,
              padding: 14,
              borderRadius: 10,
              background: '#f5f3ff',
              color: '#5b21b6',
            }}
          >
            {message}
          </div>
        )}

        <div style={{ marginTop: 44 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 18,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 24,
              }}
            >
              받은 협업 제안
            </h2>

            <span
              style={{
                color: '#6b7280',
                fontSize: 14,
              }}
            >
              총 {proposals.length}건
            </span>
          </div>

          {proposals.length === 0 ? (
            <div style={emptyStyle}>
              <p
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginTop: 0,
                }}
              >
                아직 받은 협업 제안이 없습니다.
              </p>

              <p
                style={{
                  color: '#6b7280',
                  marginBottom: 0,
                }}
              >
                광고주가 협업을 제안하면 이곳에서 확인할 수 있습니다.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 16,
              }}
            >
              {proposals.map((proposal) => (
                <article key={proposal.id} style={proposalCardStyle}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <span style={getStatusStyle(proposal.status)}>
                        {STATUS_LABELS[proposal.status] ||
                          proposal.status ||
                          '상태 미확인'}
                      </span>

                      <p
                        style={{
                          margin: '14px 0 4px',
                          color: '#6c5ce7',
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {proposal.brand_name || '브랜드명 없음'}
                      </p>

                      <h3
                        style={{
                          margin: 0,
                          fontSize: 22,
                        }}
                      >
                        {proposal.title || '제안 제목 없음'}
                      </h3>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <p
                        style={{
                          margin: 0,
                          color: '#6b7280',
                          fontSize: 13,
                        }}
                      >
                        제안 금액
                      </p>

                      <strong
                        style={{
                          display: 'block',
                          marginTop: 5,
                          fontSize: 21,
                        }}
                      >
                        {proposal.proposed_price
                          ? `${Number(
                              proposal.proposed_price
                            ).toLocaleString()}원`
                          : '금액 협의'}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                      padding: 16,
                      borderRadius: 10,
                      background: '#f9fafb',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {proposal.message || '-'}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 12,
                      marginTop: 18,
                    }}
                  >
                    <InfoItem
                      label="희망 진행일"
                      value={formatDate(proposal.desired_date)}
                    />

                    <InfoItem
                      label="제안 접수일"
                      value={formatCreatedAt(proposal.created_at)}
                    />
                  </div>

                  {proposal.status === 'pending' && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                        marginTop: 22,
                      }}
                    >
                      <button
                        type="button"
                        style={primaryButtonStyle}
                        disabled={updatingId === proposal.id}
                        onClick={() =>
                          updateProposalStatus(proposal.id, 'accepted')
                        }
                      >
                        {updatingId === proposal.id
                          ? '처리 중...'
                          : '제안 수락'}
                      </button>

                      <button
                        type="button"
                        style={secondaryButtonStyle}
                        disabled={updatingId === proposal.id}
                        onClick={() =>
                          updateProposalStatus(proposal.id, 'rejected')
                        }
                      >
                        제안 거절
                      </button>
                    </div>
                  )}

{proposal.status === 'accepted' && (
  <div style={acceptedNoticeStyle}>
    <p style={{ margin: 0 }}>
      수락한 제안입니다. 광고주와 협업 내용을 조율해 보세요.
    </p>

    <Link
     href={`/workspace/${proposal.id}`}
      style={{ textDecoration: 'none' }}
    >
      <button
        type="button"
        style={{
          ...primaryButtonStyle,
          marginTop: 12,
        }}
      >
        협업방 입장
      </button>
    </Link>
  </div>
)}

                  {proposal.status === 'rejected' && (
                    <div style={rejectedNoticeStyle}>
                      거절한 제안입니다.
                    </div>
                  )}

                  {proposal.status === 'completed' && (
                    <div style={completedNoticeStyle}>
                      완료된 협업입니다.
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
function StatCard({ label, value }) {
  return (
    <div style={statCardStyle}>
      <p style={statLabelStyle}>{label}</p>
      <strong style={statNumberStyle}>{value}</strong>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          color: '#6b7280',
          fontSize: 13,
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: '6px 0 0',
          fontWeight: 600,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function formatDate(dateValue) {
  if (!dateValue) return '일정 협의';

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatCreatedAt(dateValue) {
  if (!dateValue) return '-';

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatNotificationDate(dateValue) {
  if (!dateValue) return '-';

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getStatusStyle(status) {
  const base = {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 700,
  };

  if (status === 'accepted') {
    return {
      ...base,
      background: '#d1fae5',
      color: '#047857',
    };
  }

  if (status === 'rejected') {
    return {
      ...base,
      background: '#fee2e2',
      color: '#b91c1c',
    };
  }

  if (status === 'completed') {
    return {
      ...base,
      background: '#dbeafe',
      color: '#1d4ed8',
    };
  }

  if (status === 'cancelled') {
    return {
      ...base,
      background: '#f3f4f6',
      color: '#4b5563',
    };
  }

  return {
    ...base,
    background: '#fef3c7',
    color: '#92400e',
  };
}

const pageStyle = {
  minHeight: '100vh',
  background: '#f7f8fa',
  color: '#111827',
};

const sectionStyle = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '40px 24px 80px',
};

const notificationSectionStyle = {
  marginTop: 28,
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 22,
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
};

const statCardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 22,
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
};

const statLabelStyle = {
  margin: 0,
  color: '#6b7280',
  fontSize: 14,
};

const statNumberStyle = {
  display: 'block',
  marginTop: 10,
  fontSize: 28,
};

const profileTagStyle = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 20,
  background: '#ede9fe',
  color: '#6c5ce7',
  fontSize: 13,
  fontWeight: 700,
};

const proposalCardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 24,
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
};

const primaryButtonStyle = {
  border: 'none',
  background: '#6c5ce7',
  color: '#ffffff',
  padding: '11px 18px',
  borderRadius: 9,
  cursor: 'pointer',
  fontWeight: 700,
};

const secondaryButtonStyle = {
  border: '1px solid #d1d5db',
  background: '#ffffff',
  color: '#111827',
  padding: '10px 16px',
  borderRadius: 9,
  cursor: 'pointer',
  fontWeight: 600,
};

const acceptedNoticeStyle = {
  marginTop: 18,
  padding: 14,
  borderRadius: 10,
  background: '#ecfdf5',
  color: '#047857',
  fontWeight: 600,
};

const rejectedNoticeStyle = {
  marginTop: 18,
  padding: 14,
  borderRadius: 10,
  background: '#fef2f2',
  color: '#b91c1c',
  fontWeight: 600,
};

const completedNoticeStyle = {
  marginTop: 18,
  padding: 14,
  borderRadius: 10,
  background: '#eff6ff',
  color: '#1d4ed8',
  fontWeight: 600,
};

const emptyStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: '50px 24px',
  textAlign: 'center',
};
