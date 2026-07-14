'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function CampaignPage() {
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();

    const form = e.currentTarget;
    setMsg('저장 중입니다...');

    // 현재 로그인한 사용자 확인
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMsg('로그인 후 광고를 등록해 주세요.');
      return;
    }

    const f = new FormData(form);
    const data = Object.fromEntries(f.entries());

    const payload = {
      user_id: user.id,
      brand_name: data.brand_name,
      manager_name: data.manager_name,
      contact: data.contact,
      region: data.region,
      category: data.category,
      budget: Number(data.budget || 0),
      brief: data.brief
    };

    const { error } = await supabase
      .from('campaigns')
      .insert([payload]);

    if (error) {
      console.log(error);
      setMsg(error.message);
    } else {
      setMsg('광고 의뢰가 저장되었습니다.');
      form.reset();
    }
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
          <h2>광고주 캠페인 의뢰</h2>

          <form className="panel form-grid" onSubmit={submit}>
            <div>
              <label>브랜드/매장명</label>
              <input name="brand_name" required />
            </div>

            <div>
              <label>담당자명</label>
              <input name="manager_name" />
            </div>

            <div>
              <label>연락처</label>
              <input name="contact" required />
            </div>

            <div>
              <label>지역</label>
              <input name="region" />
            </div>

            <div>
              <label>카테고리</label>
              <input name="category" />
            </div>

            <div>
              <label>희망 예산</label>
              <input name="budget" type="number" />
            </div>

            <div className="full">
              <label>캠페인 내용</label>
              <textarea name="brief" required />
            </div>

            <button className="btn primary full" type="submit">
              광고 의뢰하기
            </button>
          </form>

          {msg && <p className="notice">{msg}</p>}
        </div>
      </section>
    </main>
  );
}
