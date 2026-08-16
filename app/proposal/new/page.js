'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default function NewProposalPage() {
  return (
    <Suspense fallback={<ProposalLoading />}>
      <NewProposalContent />
    </Suspense>
  );
}

function ProposalLoading() {
  return (
    <main>
      <section>
        <div className="container">
          <div className="notice">
            협업 제안 페이지를 불러오는 중입니다.
          </div>
        </div>
      </section>
    </main>
  );
}

function NewProposalContent() {
  const searchParams = useSearchParams();
  const creatorId = searchParams.get('creatorId');

  const [creator, setCreator] = useState(null);
  const [advertiserId, setAdvertiserId] = useState(null);

  const [form, setForm] = useState({
    brandName: '',
    title: '',
    message: '',
    proposedPrice: '',
    desiredDate: '',
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setNotice('');

      try {
        if (!creatorId) {
          setNotice('선택한 크리에이터 정보가 없습니다.');
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setNotice('협업 제안을 보내려면 먼저 로그인해 주세요.');
          return;
        }
        const { data: advertiserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_type')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profileError) {
        throw profileError;
      }
      
      if (!advertiserProfile) {
        setNotice('회원 프로필 정보를 찾을 수 없습니다.');
        return;
      }
      
      if (advertiserProfile.user_type !== 'advertiser') {
        setNotice('광고주 계정으로 로그인해야 협업 제안을 보낼 수 있습니다.');
        return;
      }
      
      setAdvertiserId(user.id);

        const { data: creatorData, error: creatorError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', creatorId)
          .eq('user_type', 'creator')
          .maybeSingle();

        if (creatorError) {
          throw creatorError;
        }

        if (!creatorData) {
          setNotice('선택한 크리에이터를 찾을 수 없습니다.');
          return;
        }

        setCreator(creatorData);

        const { data: campaigns, error: campaignError } = await supabase
          .from('campaigns')
          .select('brand_name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!campaignError && campaigns?.length > 0) {
          setForm((current) => ({
            ...current,
            brandName: campaigns[0].brand_name || '',
          }));
        }
      } catch (error) {
        console.error(error);

        setNotice(
          error?.message || '협업 제안 페이지를 불러오지 못했습니다.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [creatorId]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!advertiserId || !creatorId) {
      setNotice('광고주 또는 크리에이터 정보를 확인할 수 없습니다.');
      return;
    }

    if (!form.brandName.trim()) {
      setNotice('브랜드명을 입력해 주세요.');
      return;
    }

    if (!form.title.trim()) {
      setNotice('제안 제목을 입력해 주세요.');
      return;
    }

    if (!form.message.trim()) {
      setNotice('제안 내용을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setNotice('');
    setSuccess(false);

    try {
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .insert({
          advertiser_id: advertiserId,
          creator_id: creatorId,
          brand_name: form.brandName.trim(),
          title: form.title.trim(),
          message: form.message.trim(),
          proposed_price: form.proposedPrice
            ? Number(form.proposedPrice)
            : null,
          desired_date: form.desiredDate || null,
          status: 'pending',
        })
        .select()
        .single();

      if (proposalError) {
        throw proposalError;
      }

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: creatorId,
          proposal_id: proposal.id,
          type: 'proposal',
          title: '새로운 협업 제안이 도착했습니다.',
          message: `${form.brandName.trim()}에서 협업을 제안했습니다.`,
          is_read: false,
        });

      if (notificationError) {
        console.error('알림 생성 실패:', notificationError);
      }

      setSuccess(true);
      setNotice('협업 제안이 정상적으로 전달되었습니다.');

      setForm((current) => ({
        ...current,
        title: '',
        message: '',
        proposedPrice: '',
        desiredDate: '',
      }));
    } catch (error) {
      console.error(error);

      setSuccess(false);
      setNotice(
        error?.message || '협업 제안을 보내는 중 오류가 발생했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <ProposalLoading />;
  }

  if (!creator) {
    return (
      <main>
        <header>
          <nav>
            <Link className="logo" href="/">
              광고<span>잇다</span>
            </Link>
          </nav>
        </header>

        <section>
          <div className="container">
            <div className="notice">
              {notice || '크리에이터 정보를 확인할 수 없습니다.'}
            </div>

            <Link href="/creators" className="btn">
              크리에이터 목록으로 돌아가기
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header>
        <nav>
          <Link className="logo" href="/">
            광고<span>잇다</span>
          </Link>
        </nav>
      </header>

      <section>
        <div className="container">
          <Link href={`/creator/${creator.id}`} className="small">
            ← 크리에이터 상세로 돌아가기
          </Link>

          <div
            style={{
              maxWidth: 720,
              margin: '30px auto 0',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                padding: 28,
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: '#6b7280',
                  fontSize: 14,
                }}
              >
                협업 제안
              </p>

              <h1
                style={{
                  margin: '8px 0 6px',
                }}
              >
                {creator.name}님께 협업 제안하기
              </h1>

              <p
                style={{
                  margin: 0,
                  color: '#6b7280',
                }}
              >
                제안 내용을 작성하면 크리에이터에게 전달됩니다.
              </p>

              <form
                onSubmit={handleSubmit}
                style={{
                  display: 'grid',
                  gap: 20,
                  marginTop: 30,
                }}
              >
                <div>
                  <label style={labelStyle}>브랜드명</label>

                  <input
                    name="brandName"
                    value={form.brandName}
                    onChange={handleChange}
                    placeholder="예: 광고잇다"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>제안 제목</label>

                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="예: 대구 신메뉴 릴스 콘텐츠 협업 제안"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>제안 내용</label>

                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="협업 내용, 촬영 방식, 요청사항 등을 입력해 주세요."
                    rows={7}
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>제안 금액</label>

                  <input
                    type="number"
                    name="proposedPrice"
                    value={form.proposedPrice}
                    onChange={handleChange}
                    placeholder="예: 300000"
                    min="0"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>희망 진행일</label>

                  <input
                    type="date"
                    name="desiredDate"
                    value={form.desiredDate}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>

                {notice && (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: success ? '#ecfdf5' : '#fef2f2',
                      color: success ? '#047857' : '#b91c1c',
                      fontWeight: 600,
                    }}
                  >
                    {notice}
                  </div>
                )}

                {success ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Link
                      href="/advertiser"
                      className="btn primary"
                    >
                      광고주 대시보드로 이동
                    </Link>

                    <Link
                      href="/creators"
                      className="btn"
                    >
                      다른 크리에이터 보기
                    </Link>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      border: 'none',
                      background: '#6c5ce7',
                      color: '#ffffff',
                      padding: '14px 20px',
                      borderRadius: 10,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      fontSize: 16,
                      fontWeight: 700,
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting
                      ? '제안 보내는 중...'
                      : '협업 제안 보내기'}
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const labelStyle = {
  display: 'block',
  marginBottom: 8,
  fontSize: 14,
  fontWeight: 700,
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 15,
  outline: 'none',
};

