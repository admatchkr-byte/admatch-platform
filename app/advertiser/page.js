'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

const STATUS_LABELS = {
  pending: '대기 중',
  accepted: '수락됨',
  rejected: '거절됨',
  completed: '협업 완료',
  cancelled: '취소됨',
};

export default function AdvertiserPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setMessage('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        setMessage('로그인이 필요합니다.');
        setLoading(false);
        return;
      }

      const user = session.user;
      setUserEmail(user.email || '');

      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (campaignError) {
        throw campaignError;
      }

      setCampaigns(campaignData || []);

      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select('*')
        .eq('advertiser_id', user.id)
        .order('created_at', { ascending: false });

      if (proposalError) {
        throw proposalError;
      }

      const creatorIds = [
        ...new Set(
          (proposalData || [])
            .map((proposal) => proposal.creator_id)
            .filter(Boolean)
        ),
      ];

      let creatorMap = {};

      if (creatorIds.length > 0) {
        const { data: creatorData, error: creatorError } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', creatorIds);

        if (creatorError) {
          throw creatorError;
        }

        creatorMap = Object.fromEntries(
          (creatorData || []).map((creator) => [
            creator.id,
            creator.name,
          ])
        );
      }

      const proposalsWithCreatorName = (proposalData || []).map(
        (proposal) => ({
          ...proposal,
          creator_name:
            creatorMap[proposal.creator_id] || '크리에이터 정보 없음',
        })
      );

      setProposals(proposalsWithCreatorName);
    } catch (error) {
      console.error(error);
      setMessage(
        `대시보드 정보를 불러오지 못했습니다: ${
          error?.message || '알 수 없는 오류'
        }`
      );
      setCampaigns([]);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const recruitingCampaigns = campaigns.filter(
    (campaign) => !campaign.status || campaign.status === 'recruiting'
  ).length;

  const activeProposals = proposals.filter(
    (proposal) => proposal.status === 'accepted'
  ).length;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f7f8fa',
        color: '#111827',
      }}
    >
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
            alignItems: 'center',
            justifyContent: 'space-between',
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

          <button
            type="button"
            onClick={handleLogout}
            style={{
              border: '1px solid #d1d5db',
              background: '#ffffff',
              padding: '9px 14px',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '40px 24px 80px',
        }}
      >
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
              광고주 대시보드
            </p>

            <h1
              style={{
                margin: '8px 0 0',
                fontSize: 32,
              }}
            >
              안녕하세요 👋
            </h1>

            {userEmail && (
              <p
                style={{
                  marginTop: 8,
                  color: '#6b7280',
                }}
              >
                {userEmail}
              </p>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <Link href="/creators" style={{ textDecoration: 'none' }}>
              <button
                type="button"
                style={{
                  border: '1px solid #6c5ce7',
                  background: '#ffffff',
                  color: '#6c5ce7',
                  padding: '13px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                크리에이터 찾기
              </button>
            </Link>

            <Link href="/campaign" style={{ textDecoration: 'none' }}>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: '#6c5ce7',
                  color: '#ffffff',
                  padding: '13px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                + 광고 등록하기
              </button>
            </Link>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginTop: 32,
          }}
        >
          <div style={statCardStyle}>
            <p style={statLabelStyle}>전체 광고</p>
            <strong style={statNumberStyle}>{campaigns.length}</strong>
          </div>

          <div style={statCardStyle}>
            <p style={statLabelStyle}>모집 중</p>
            <strong style={statNumberStyle}>{recruitingCampaigns}</strong>
          </div>

          <div style={statCardStyle}>
            <p style={statLabelStyle}>보낸 제안</p>
            <strong style={statNumberStyle}>{proposals.length}</strong>
          </div>

          <div style={statCardStyle}>
            <p style={statLabelStyle}>진행 중</p>
            <strong style={statNumberStyle}>{activeProposals}</strong>
          </div>
        </div>

        {loading && (
          <div style={{ ...emptyStyle, marginTop: 40 }}>
            <p>대시보드 정보를 불러오는 중입니다...</p>
          </div>
        )}

        {!loading && message && (
          <div style={{ ...emptyStyle, marginTop: 40 }}>
            <p style={{ color: '#dc2626' }}>{message}</p>

            <button
              type="button"
              onClick={loadDashboard}
              style={{
                marginTop: 12,
                border: 'none',
                background: '#6c5ce7',
                color: '#ffffff',
                padding: '10px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              다시 불러오기
            </button>
          </div>
        )}

        {!loading && !message && (
          <>
            <div style={{ marginTop: 44 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 24,
                  }}
                >
                  내 광고
                </h2>

                <span
                  style={{
                    color: '#6b7280',
                    fontSize: 14,
                  }}
                >
                  총 {campaigns.length}건
                </span>
              </div>

              {campaigns.length === 0 ? (
                <div style={emptyStyle}>
                  <p style={{ fontSize: 18, fontWeight: 700 }}>
                    아직 등록한 광고가 없습니다.
                  </p>

                  <p style={{ color: '#6b7280' }}>
                    광고를 등록하고 적합한 크리에이터를 직접 찾아보세요.
                  </p>

                  <Link href="/campaign" style={{ textDecoration: 'none' }}>
                    <button
                      type="button"
                      style={{
                        marginTop: 10,
                        border: 'none',
                        background: '#6c5ce7',
                        color: '#ffffff',
                        padding: '11px 18px',
                        borderRadius: 9,
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      광고 등록하기
                    </button>
                  </Link>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gap: 16,
                  }}
                >
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 14,
                        padding: 24,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 16,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <span style={statusBadgeStyle}>
                            {campaign.status === 'completed'
                              ? '완료'
                              : campaign.status === 'progress'
                              ? '진행 중'
                              : '모집 중'}
                          </span>

                          <h3
                            style={{
                              margin: '14px 0 6px',
                              fontSize: 22,
                            }}
                          >
                            {campaign.brand_name || '브랜드명 없음'}
                          </h3>

                          <p
                            style={{
                              margin: 0,
                              color: '#6b7280',
                            }}
                          >
                            {campaign.category || '카테고리 미입력'}
                          </p>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <p
                            style={{
                              margin: 0,
                              color: '#6b7280',
                              fontSize: 13,
                            }}
                          >
                            희망 예산
                          </p>

                          <strong
                            style={{
                              display: 'block',
                              marginTop: 5,
                              fontSize: 20,
                            }}
                          >
                            {Number(
                              campaign.budget || 0
                            ).toLocaleString()}
                            원
                          </strong>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: 12,
                          marginTop: 22,
                          paddingTop: 18,
                          borderTop: '1px solid #f0f0f0',
                        }}
                      >
                        <InfoItem
                          label="지역"
                          value={campaign.region || '-'}
                        />

                        <InfoItem
                          label="담당자"
                          value={campaign.manager_name || '-'}
                        />

                        <InfoItem
                          label="연락처"
                          value={campaign.contact || '-'}
                        />
                      </div>

                      <div
                        style={{
                          marginTop: 18,
                          padding: 16,
                          background: '#f9fafb',
                          borderRadius: 10,
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 7px',
                            fontSize: 13,
                            color: '#6b7280',
                          }}
                        >
                          캠페인 내용
                        </p>

                        <p
                          style={{
                            margin: 0,
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {campaign.brief || '-'}
                        </p>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: 10,
                          marginTop: 18,
                        }}
                      >
                        <Link
                          href={`/campaign/${campaign.id}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <button
                            type="button"
                            style={{
                              border: '1px solid #d1d5db',
                              background: '#ffffff',
                              padding: '9px 14px',
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                          >
                            상세보기
                          </button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 60 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 24,
                  }}
                >
                  보낸 협업 제안
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
                  <p style={{ fontSize: 18, fontWeight: 700 }}>
                    아직 보낸 협업 제안이 없습니다.
                  </p>

                  <p style={{ color: '#6b7280' }}>
                    원하는 크리에이터를 찾아 직접 협업을 제안해 보세요.
                  </p>

                  <Link href="/creators" style={{ textDecoration: 'none' }}>
                    <button
                      type="button"
                      style={{
                        marginTop: 10,
                        border: 'none',
                        background: '#6c5ce7',
                        color: '#ffffff',
                        padding: '11px 18px',
                        borderRadius: 9,
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      크리에이터 찾기
                    </button>
                  </Link>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gap: 16,
                  }}
                >
                  {proposals.map((proposal) => (
                    <article
                      key={proposal.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 14,
                        padding: 24,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                      }}
                    >
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
                          <span style={getProposalStatusStyle(proposal.status)}>
                            {STATUS_LABELS[proposal.status] ||
                              proposal.status ||
                              '상태 미확인'}
                          </span>

                          <h3
                            style={{
                              margin: '14px 0 6px',
                              fontSize: 22,
                            }}
                          >
                            {proposal.brand_name || '브랜드명 없음'}
                          </h3>

                          <p
                            style={{
                              margin: 0,
                              color: '#6b7280',
                            }}
                          >
                            크리에이터: {proposal.creator_name}
                          </p>
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
                              fontSize: 20,
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
                          marginTop: 20,
                          paddingTop: 18,
                          borderTop: '1px solid #f0f0f0',
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 8px',
                            fontSize: 13,
                            color: '#6b7280',
                          }}
                        >
                          제안 제목
                        </p>

                        <p
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            fontSize: 17,
                          }}
                        >
                          {proposal.title || '-'}
                        </p>
                      </div>

                      <div
                        style={{
                          marginTop: 16,
                          padding: 16,
                          background: '#f9fafb',
                          borderRadius: 10,
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
                          label="제안일"
                          value={formatDateTime(proposal.created_at)}
                        />
                      </div>

                      {proposal.status === 'accepted' && (
  <div
    style={{
      marginTop: 18,
      padding: 14,
      borderRadius: 10,
      background: '#ecfdf5',
      color: '#047857',
      fontWeight: 600,
    }}
  >
    <p style={{ margin: 0 }}>
      크리에이터가 제안을 수락했습니다.
    </p>

    <Link
     href={`/workspace/${proposal.id}`}
      style={{ textDecoration: 'none' }}
    >
      <button
        type="button"
        style={{
          marginTop: 12,
          border: 'none',
          background: '#6c5ce7',
          color: '#ffffff',
          padding: '10px 16px',
          borderRadius: 9,
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        협업방 입장
      </button>
    </Link>
  </div>
)}

                      {proposal.status === 'rejected' && (
                        <div
                          style={{
                            marginTop: 18,
                            padding: 14,
                            borderRadius: 10,
                            background: '#fef2f2',
                            color: '#b91c1c',
                            fontWeight: 600,
                          }}
                        >
                          크리에이터가 제안을 거절했습니다.
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
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

function formatDate(value) {
  if (!value) return '일정 협의';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getProposalStatusStyle(status) {
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

const statusBadgeStyle = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 20,
  background: '#ede9fe',
  color: '#6c5ce7',
  fontSize: 13,
  fontWeight: 700,
};

const emptyStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: '50px 24px',
  textAlign: 'center',
};
