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

      if (!creatorId) {
        setNotice('선택한 크리에이터 정보가 없습니다.');
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setNotice('협업 제안을 보내려면 먼저 로그인해 주세요.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', creatorId)
        .eq('user_type', 'creator')
        .maybeSingle();

      if (error) {
        console.error(error);
        setNotice(
          error.message || '크리에이터 정보를 불러오지 못했습니다.'
        );
        setLoading(false);
        return;
      }

      if (!data) {
        setNotice('선택한 크리에이터를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      setCreator(data);
      setLoading(false);
    }

    loadPage();
  }, [creatorId]);

  // 여기 아래에는 기존 page.js의 나머지 함수와 return 코드를 그대로 둬.
}
