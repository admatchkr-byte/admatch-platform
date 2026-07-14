'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const [creators, setCreators] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [msg, setMsg] = useState('');

  async function load() {
    const c = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const p = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (c.error || p.error) setMsg('Supabase 연결 전입니다. DB 연결 후 목록이 표시됩니다.');
    setCreators(c.data || []);
    setCampaigns(p.data || []);
  }

  useEffect(() => { load(); }, []);

  return (
    <main>
      <header><nav><Link className="logo" href="/">광고<span>잇다</span></Link></nav></header>
      <section><div className="container">
        <h2>관리자</h2>
        <p className="desc">초기에는 여기서 수동 매칭하면 됩니다.</p>
        {msg && <div className="notice">{msg}</div>}
        <h3>인플루언서 목록</h3>
        <table>
          <thead><tr><th>활동명</th><th>지역</th><th>카테고리</th><th>채널</th><th>단가</th><th>연락처</th></tr></thead>
          <tbody>{creators.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.region}</td><td>{c.category}</td><td>{c.channel}</td><td>{Number(c.price || 0).toLocaleString()}원</td><td>{c.contact}</td></tr>)}</tbody>
        </table>

        <h3>광고 의뢰 목록</h3>
        <table>
          <thead><tr><th>브랜드</th><th>지역</th><th>예산</th><th>연락처</th><th>내용</th></tr></thead>
          <tbody>{campaigns.map(c => <tr key={c.id}><td>{c.brand_name}</td><td>{c.region}</td><td>{Number(c.budget || 0).toLocaleString()}원</td><td>{c.contact}</td><td>{c.brief}</td></tr>)}</tbody>
        </table>
      </div></section>
    </main>
  );
}
