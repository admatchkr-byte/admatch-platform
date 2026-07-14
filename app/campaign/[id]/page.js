'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();

  const campaignId = params.id;

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId]);

  async function loadCampaign() {
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

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        throw error;
      }

      setCampaign(data);
    } catch (error) {
      console.error(error);
      setMessage(
        '광고를 찾을 수 없거나 조회할 권한이 없습니다.'
      );
    } finally {
      setLoading(false);
    }
  }

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
            maxWidth: 1000,
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
              color: '#111827',
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            광고<span style={{ color: '#6c5ce7' }}>잇다</span>
          </Link>

          <Link
            href="/advertiser"
            style={{
              textDecoration: 'none',
              color: '#4b5563',
              fontWeight: 600,
            }}
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </header>

      <section
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          padding: '40px 24px 80px',
        }}
      >
        {loading && (
          <div style={boxStyle}>
            <p>광고 정보를 불러오는 중입니다...</p>
          </div>
        )}

        {!loading && message && (
          <div style={boxStyle}>
            <p style={{ color: '#dc2626' }}>{message}</p>

            <button
              onClick={() => router.push('/advertiser')}
              style={purpleButtonStyle}
            >
              광고주 대시보드로 이동
            </button>
          </div>
        )}

        {!loading && campaign && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 20,
                flexWrap: 'wrap',
                marginBottom: 24,
              }}
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '6px 11px',
                    borderRadius: 20,
                    background: '#ede9fe',
                    color: '#6c5ce7',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  모집 중
                </span>

                <h1
                  style={{
                    margin: '14px 0 8px',
                    fontSize: 32,
                  }}
                >
                  {campaign.brand_name || '브랜드명 없음'}
                </h1>

                <p
                  style={{
                    margin: 0,
                    color: '#6b7280',
                  }}
                >
                  광고 상세정보
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  style={whiteButtonStyle}
                  onClick={() => alert('다음 단계에서 수정 기능을 연결할게요.')}
                >
                  수정
                </button>

                <button
                  type="button"
                  style={deleteButtonStyle}
                  onClick={() => alert('다음 단계에서 삭제 기능을 연결할게요.')}
                >
                  삭제
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 22,
                  fontSize: 22,
                }}
              >
                기본 정보
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 20,
                }}
              >
                <InfoItem
                  label="담당자"
                  value={campaign.manager_name || '-'}
                />

                <InfoItem
                  label="연락처"
                  value={campaign.contact || '-'}
                />

                <InfoItem
                  label="지역"
                  value={campaign.region || '-'}
                />

                <InfoItem
                  label="카테고리"
                  value={campaign.category || '-'}
                />

                <InfoItem
                  label="희망 예산"
                  value={`${Number(
                    campaign.budget || 0
                  ).toLocaleString()}원`}
                />

                <InfoItem
                  label="지원자"
                  value="0명"
                />
              </div>
            </div>

            <div
              style={{
                ...cardStyle,
                marginTop: 20,
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 16,
                  fontSize: 22,
                }}
              >
                캠페인 내용
              </h2>

              <div
                style={{
                  padding: 20,
                  background: '#f9fafb',
                  borderRadius: 10,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {campaign.brief || '등록된 캠페인 내용이 없습니다.'}
              </div>
            </div>

            <div
              style={{
                ...cardStyle,
                marginTop: 20,
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 10,
                  fontSize: 22,
                }}
              >
                지원자 목록
              </h2>

              <p
                style={{
                  margin: 0,
                  color: '#6b7280',
                }}
              >
                아직 지원한 인플루언서가 없습니다.
              </p>
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
          fontSize: 13,
          color: '#6b7280',
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: '7px 0 0',
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        {value}
      </p>
    </div>
  );
}

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 26,
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
};

const boxStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 40,
  textAlign: 'center',
};

const whiteButtonStyle = {
  border: '1px solid #d1d5db',
  background: '#ffffff',
  padding: '10px 16px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
};

const deleteButtonStyle = {
  border: '1px solid #fecaca',
  background: '#ffffff',
  color: '#dc2626',
  padding: '10px 16px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
};

const purpleButtonStyle = {
  marginTop: 14,
  border: 'none',
  background: '#6c5ce7',
  color: '#ffffff',
  padding: '11px 18px',
  borderRadius: 9,
  cursor: 'pointer',
  fontWeight: 700,
};

