'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function CreatorRegisterPage() {
  const [userEmail, setUserEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setMsg('로그인 후 크리에이터 프로필을 등록할 수 있습니다.');
        setLoadingUser(false);
        return;
      }

      setUserEmail(user.email || '');
      setLoadingUser(false);
    }

    loadUser();
  }, []);

  async function submit(e) {
    e.preventDefault();

    // await 실행 전에 폼 정보를 먼저 저장
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    const data = Object.fromEntries(formData.entries());

    setMsg('');
    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMsg('로그인 후 크리에이터 프로필을 등록할 수 있습니다.');
      setSaving(false);
      return;
    }

    const payload = {
      id: user.id,
      user_type: 'creator',
      name: data.name?.trim(),
      email: user.email,
      contact: data.contact?.trim(),
      region: data.region,
      category: data.category,
      channel: data.channel,
      followers: Number(data.followers || 0),
      avg_views: Number(data.avg_views || 0),
      price: Number(data.price || 0),
      intro: data.intro?.trim(),
      portfolio_url: data.portfolio_url?.trim() || null,
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(payload, {
        onConflict: 'id',
      });

    if (error) {
      console.error(error);
      setMsg(error.message || '크리에이터 프로필 등록에 실패했습니다.');
      setSaving(false);
      return;
    }

    setMsg('크리에이터 프로필이 등록되었습니다.');
    setSaving(false);

    window.location.href = '/creator';
  }

  if (loadingUser) {
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
              로그인 정보를 확인하는 중입니다.
            </div>
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
          <h2>크리에이터 프로필 등록</h2>

          <p className="desc">
            광고주에게 공개할 활동 정보를 입력해 주세요.
          </p>

          <form
            className="panel form-grid"
            onSubmit={submit}
          >
            <div>
              <label htmlFor="name">활동명</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="예: 대구맛집소예"
                required
              />
            </div>

            <div>
              <label htmlFor="email">이메일</label>
              <input
                id="email"
                name="email"
                type="email"
                value={userEmail}
                readOnly
              />
            </div>

            <div>
              <label htmlFor="contact">연락처</label>
              <input
                id="contact"
                name="contact"
                type="text"
                placeholder="01012345678"
                required
              />
            </div>

            <div>
              <label htmlFor="region">지역</label>
              <select
                id="region"
                name="region"
                defaultValue="대구"
              >
                <option value="대구">대구</option>
                <option value="서울">서울</option>
                <option value="부산">부산</option>
                <option value="전국">전국</option>
              </select>
            </div>

            <div>
              <label htmlFor="category">카테고리</label>
              <select
                id="category"
                name="category"
                defaultValue="맛집"
              >
                <option value="맛집">맛집</option>
                <option value="뷰티">뷰티</option>
                <option value="패션">패션</option>
                <option value="여행">여행</option>
                <option value="생활">생활</option>
              </select>
            </div>

            <div>
              <label htmlFor="channel">채널</label>
              <select
                id="channel"
                name="channel"
                defaultValue="인스타그램"
              >
                <option value="인스타그램">인스타그램</option>
                <option value="블로그">블로그</option>
                <option value="유튜브">유튜브</option>
                <option value="틱톡">틱톡</option>
              </select>
            </div>

            <div>
              <label htmlFor="followers">팔로워/방문자 수</label>
              <input
                id="followers"
                name="followers"
                type="number"
                min="0"
                placeholder="10000"
                required
              />
            </div>

            <div>
              <label htmlFor="avg_views">평균 조회수</label>
              <input
                id="avg_views"
                name="avg_views"
                type="number"
                min="0"
                placeholder="20000"
                required
              />
            </div>

            <div>
              <label htmlFor="price">희망 단가</label>
              <input
                id="price"
                name="price"
                type="number"
                min="0"
                placeholder="300000"
                required
              />
            </div>

            <div>
              <label htmlFor="portfolio_url">
                포트폴리오 URL
              </label>
              <input
                id="portfolio_url"
                name="portfolio_url"
                type="url"
                placeholder="https://instagram.com/..."
              />
            </div>

            <div className="full">
              <label htmlFor="intro">소개</label>
              <textarea
                id="intro"
                name="intro"
                rows={6}
                placeholder="활동 분야와 콘텐츠 특징을 소개해 주세요."
                required
              />
            </div>

            <button
              className="btn primary full"
              type="submit"
              disabled={saving}
            >
              {saving ? '등록 중...' : '등록하기'}
            </button>
          </form>

          {msg && <p className="notice">{msg}</p>}
        </div>
      </section>
    </main>
  );
}
