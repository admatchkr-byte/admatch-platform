'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

const TABS = {
  chat: '채팅',
  content: '콘텐츠 제출',
  contract: '계약서',
};

const CONTENT_STATUS_LABELS = {
  submitted: '검수 대기',
  revision_requested: '수정 요청',
  approved: '승인 완료',
};

export default function WorkspacePage() {
  const params = useParams();
  const proposalId = params?.proposalId;

  const [activeTab, setActiveTab] = useState('chat');
  const [user, setUser] = useState(null);
  const [proposal, setProposal] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [submissionForm, setSubmissionForm] = useState({
    title: '',
    description: '',
    file: null,
  });
  const [uploading, setUploading] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  const [contract, setContract] = useState(null);
  const [contractForm, setContractForm] = useState({
    contractTitle: '',
    workScope: '',
    paymentAmount: '',
    dueDate: '',
    specialTerms: '',
  });
  const [savingContract, setSavingContract] = useState(false);
  const [agreeing, setAgreeing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const bottomRef = useRef(null);

  const isAdvertiser = useMemo(() => {
    return Boolean(
      user &&
        proposal &&
        proposal.advertiser_id === user.id
    );
  }, [user, proposal]);

  const isCreator = useMemo(() => {
    return Boolean(
      user &&
        proposal &&
        proposal.creator_id === user.id
    );
  }, [user, proposal]);

  const receiverId = useMemo(() => {
    if (!user || !proposal) return null;

    return isAdvertiser
      ? proposal.creator_id
      : proposal.advertiser_id;
  }, [user, proposal, isAdvertiser]);

  useEffect(() => {
    loadWorkspace();
  }, [proposalId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    if (!proposalId || !user?.id) return;

    const channel = supabase
      .channel(`workspace-chat-${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `proposal_id=eq.${proposalId}`,
        },
        async (payload) => {
          const newMessage = payload.new;

          setMessages((current) => {
            const exists = current.some(
              (item) => item.id === newMessage.id
            );

            return exists
              ? current
              : [...current, newMessage];
          });

          if (
            newMessage.receiver_id === user.id &&
            !newMessage.is_read
          ) {
            await markMessageRead(newMessage.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          setMessages((current) =>
            current.map((item) =>
              item.id === payload.new.id
                ? payload.new
                : item
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proposalId, user?.id]);

  async function loadWorkspace() {
    if (!proposalId) {
      setNotice('협업 제안 정보가 없습니다.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotice('');

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        setNotice('로그인 후 협업방을 이용할 수 있습니다.');
        return;
      }

      setUser(currentUser);

      const { data: proposalData, error: proposalError } =
        await supabase
          .from('proposals')
          .select(`
            id,
            advertiser_id,
            creator_id,
            brand_name,
            title,
            message,
            proposed_price,
            desired_date,
            status
          `)
          .eq('id', proposalId)
          .maybeSingle();

      if (proposalError) throw proposalError;

      if (!proposalData) {
        setNotice('협업 제안을 찾을 수 없습니다.');
        return;
      }

      const isParticipant =
        proposalData.advertiser_id === currentUser.id ||
        proposalData.creator_id === currentUser.id;

      if (!isParticipant) {
        setNotice('이 협업방에 접근할 권한이 없습니다.');
        return;
      }

      if (proposalData.status !== 'accepted') {
        setNotice('수락된 협업 제안만 협업방을 이용할 수 있습니다.');
        return;
      }

      setProposal(proposalData);

      await Promise.all([
        loadMessages(currentUser.id),
        loadSubmissions(),
        loadContract(),
      ]);
    } catch (error) {
      console.error(error);
      setNotice(
        error?.message || '협업방을 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(currentUserId) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const loadedMessages = data || [];
    setMessages(loadedMessages);

    const unreadIds = loadedMessages
      .filter(
        (item) =>
          item.receiver_id === currentUserId &&
          !item.is_read
      )
      .map((item) => item.id);

    if (unreadIds.length > 0) {
      const { error: readError } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .in('id', unreadIds)
        .eq('receiver_id', currentUserId);

      if (!readError) {
        setMessages((current) =>
          current.map((item) =>
            unreadIds.includes(item.id)
              ? { ...item, is_read: true }
              : item
          )
        );
      }
    }
  }

  async function loadSubmissions() {
    const { data, error } = await supabase
      .from('content_submissions')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = data || [];

    const rowsWithUrls = await Promise.all(
      rows.map(async (item) => {
        if (!item.file_url) return item;

        const { data: signedData } = await supabase.storage
          .from('workspace-files')
          .createSignedUrl(item.file_url, 3600);

        return {
          ...item,
          signed_url: signedData?.signedUrl || null,
        };
      })
    );

    setSubmissions(rowsWithUrls);
  }

  async function loadContract() {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('proposal_id', proposalId)
      .maybeSingle();

    if (error) throw error;

    setContract(data || null);

    if (data) {
      setContractForm({
        contractTitle: data.contract_title || '',
        workScope: data.work_scope || '',
        paymentAmount: data.payment_amount
          ? String(data.payment_amount)
          : '',
        dueDate: data.due_date || '',
        specialTerms: data.special_terms || '',
      });
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    const message = chatInput.trim();

    if (
      !message ||
      !user ||
      !receiverId ||
      sendingMessage
    ) {
      return;
    }

    setSendingMessage(true);
    setNotice('');

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        proposal_id: proposalId,
        sender_id: user.id,
        receiver_id: receiverId,
        message,
        is_read: false,
      });

    if (error) {
      console.error(error);
      setNotice(error.message || '메시지 전송에 실패했습니다.');
    } else {
      setChatInput('');
    }

    setSendingMessage(false);
  }

  async function markMessageRead(messageId) {
    if (!user) return;

    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('id', messageId)
      .eq('receiver_id', user.id);

    if (error) console.error(error);
  }

  function changeSubmissionField(event) {
    const { name, value, files } = event.target;

    setSubmissionForm((current) => ({
      ...current,
      [name]: files ? files[0] || null : value,
    }));
  }

  async function submitContent(event) {
    event.preventDefault();

    if (!isCreator || !submissionForm.file) {
      setNotice('제출할 파일을 선택해 주세요.');
      return;
    }

    if (!submissionForm.title.trim()) {
      setNotice('콘텐츠 제목을 입력해 주세요.');
      return;
    }

    setUploading(true);
    setNotice('');

    try {
      const file = submissionForm.file;
      const safeFileName = file.name.replace(
        /[^a-zA-Z0-9가-힣._-]/g,
        '_'
      );

      const storagePath = `${proposalId}/${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('workspace-files')
        .upload(storagePath, file, {
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('content_submissions')
        .insert({
          proposal_id: proposalId,
          creator_id: proposal.creator_id,
          advertiser_id: proposal.advertiser_id,
          title: submissionForm.title.trim(),
          description:
            submissionForm.description.trim() || null,
          file_url: storagePath,
          file_name: file.name,
          status: 'submitted',
          revision_message: null,
        });

      if (insertError) throw insertError;

      setSubmissionForm({
        title: '',
        description: '',
        file: null,
      });

      const fileInput =
        document.getElementById('workspace-file');

      if (fileInput) fileInput.value = '';

      await loadSubmissions();
      setNotice('콘텐츠가 제출되었습니다.');
    } catch (error) {
      console.error(error);
      setNotice(
        error?.message || '콘텐츠 제출에 실패했습니다.'
      );
    } finally {
      setUploading(false);
    }
  }

  async function reviewSubmission(submissionId, nextStatus) {
    if (!isAdvertiser) return;

    let revisionMessage = null;

    if (nextStatus === 'revision_requested') {
      revisionMessage = window.prompt(
        '크리에이터에게 전달할 수정 요청 내용을 입력해 주세요.'
      );

      if (!revisionMessage?.trim()) return;
    }

    const confirmed = window.confirm(
      nextStatus === 'approved'
        ? '이 콘텐츠를 승인하시겠습니까?'
        : '수정을 요청하시겠습니까?'
    );

    if (!confirmed) return;

    setReviewingId(submissionId);
    setNotice('');

    const { error } = await supabase
      .from('content_submissions')
      .update({
        status: nextStatus,
        revision_message:
          nextStatus === 'revision_requested'
            ? revisionMessage.trim()
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .eq('advertiser_id', user.id);

    if (error) {
      setNotice(error.message || '검수 처리에 실패했습니다.');
    } else {
      await loadSubmissions();
      setNotice(
        nextStatus === 'approved'
          ? '콘텐츠를 승인했습니다.'
          : '수정을 요청했습니다.'
      );
    }

    setReviewingId(null);
  }

  function changeContractField(event) {
    const { name, value } = event.target;

    setContractForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function saveContract(event) {
    event.preventDefault();

    if (!isAdvertiser) return;

    if (
      !contractForm.contractTitle.trim() ||
      !contractForm.workScope.trim()
    ) {
      setNotice('계약 제목과 업무 범위를 입력해 주세요.');
      return;
    }

    setSavingContract(true);
    setNotice('');

    const payload = {
      proposal_id: proposalId,
      advertiser_id: proposal.advertiser_id,
      creator_id: proposal.creator_id,
      contract_title:
        contractForm.contractTitle.trim(),
      work_scope: contractForm.workScope.trim(),
      payment_amount: contractForm.paymentAmount
        ? Number(contractForm.paymentAmount)
        : null,
      due_date: contractForm.dueDate || null,
      special_terms:
        contractForm.specialTerms.trim() || null,
      status: 'waiting',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('contracts')
      .upsert(payload, {
        onConflict: 'proposal_id',
      });

    if (error) {
      setNotice(error.message || '계약서 저장에 실패했습니다.');
    } else {
      await loadContract();
      setNotice('계약서가 저장되었습니다.');
    }

    setSavingContract(false);
  }

  async function agreeContract() {
    if (!contract || !user) return;

    const confirmed = window.confirm(
      '계약 내용을 확인했으며 이에 동의하시겠습니까?'
    );

    if (!confirmed) return;

    setAgreeing(true);
    setNotice('');

    const now = new Date().toISOString();

    const updatePayload = isAdvertiser
      ? {
          advertiser_agreed: true,
          advertiser_agreed_at: now,
        }
      : {
          creator_agreed: true,
          creator_agreed_at: now,
        };

    const nextAdvertiserAgreed = isAdvertiser
      ? true
      : contract.advertiser_agreed;

    const nextCreatorAgreed = isCreator
      ? true
      : contract.creator_agreed;

    updatePayload.status =
      nextAdvertiserAgreed && nextCreatorAgreed
        ? 'completed'
        : 'waiting';

    updatePayload.updated_at = now;

    const { error } = await supabase
      .from('contracts')
      .update(updatePayload)
      .eq('id', contract.id);

    if (error) {
      setNotice(error.message || '계약 동의 처리에 실패했습니다.');
    } else {
      await loadContract();
      setNotice(
        updatePayload.status === 'completed'
          ? '양측 동의가 완료되어 계약이 체결되었습니다.'
          : '계약 동의가 완료되었습니다.'
      );
    }

    setAgreeing(false);
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={panelStyle}>협업방을 불러오는 중입니다.</div>
      </main>
    );
  }

  if (!proposal) {
    return (
      <main style={pageStyle}>
        <div style={panelStyle}>
          <p style={{ color: '#dc2626' }}>{notice}</p>
          <Link href="/">홈으로 돌아가기</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={workspaceHeaderStyle}>
        <div>
          <p style={eyebrowStyle}>광고잇다 협업방</p>
          <h1 style={{ margin: '6px 0 0' }}>
            {proposal.brand_name || '브랜드명 없음'}
          </h1>
          <p style={mutedStyle}>{proposal.title}</p>
        </div>

        <Link
          href={isAdvertiser ? '/advertiser' : '/creator'}
          style={{ textDecoration: 'none' }}
        >
          <button type="button" style={secondaryButtonStyle}>
            대시보드로
          </button>
        </Link>
      </header>

      <div style={summaryStyle}>
        <InfoItem
          label="참여 유형"
          value={isAdvertiser ? '광고주' : '크리에이터'}
        />
        <InfoItem
          label="제안 금액"
          value={
            proposal.proposed_price
              ? `${Number(
                  proposal.proposed_price
                ).toLocaleString()}원`
              : '금액 협의'
          }
        />
        <InfoItem
          label="희망 진행일"
          value={formatDate(proposal.desired_date)}
        />
      </div>

      <nav style={tabNavigationStyle}>
        {Object.entries(TABS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              ...tabButtonStyle,
              ...(activeTab === key
                ? activeTabButtonStyle
                : {}),
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {notice && <div style={noticeStyle}>{notice}</div>}

      {activeTab === 'chat' && (
        <section>
          <div style={chatBoxStyle}>
            {messages.length === 0 ? (
              <p style={emptyMessageStyle}>
                아직 메시지가 없습니다.
              </p>
            ) : (
              messages.map((item) => {
                const isMine = item.sender_id === user.id;

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: isMine
                        ? 'flex-end'
                        : 'flex-start',
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        ...messageBubbleStyle,
                        background: isMine
                          ? '#6c5ce7'
                          : '#f3f4f6',
                        color: isMine
                          ? '#ffffff'
                          : '#111827',
                      }}
                    >
                      <div>{item.message}</div>

                      <div style={messageMetaStyle}>
                        {isMine && (
                          <span>
                            {item.is_read ? '읽음' : '전송됨'}
                          </span>
                        )}
                        <span>{formatTime(item.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} style={chatFormStyle}>
            <input
              value={chatInput}
              onChange={(event) =>
                setChatInput(event.target.value)
              }
              placeholder="메시지를 입력하세요."
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={
                sendingMessage || !chatInput.trim()
              }
              style={primaryButtonStyle}
            >
              {sendingMessage ? '전송 중...' : '전송'}
            </button>
          </form>
        </section>
      )}

      {activeTab === 'content' && (
        <section>
          {isCreator && (
            <form
              onSubmit={submitContent}
              style={panelStyle}
            >
              <h2 style={{ marginTop: 0 }}>
                콘텐츠 제출
              </h2>

              <FormField label="콘텐츠 제목">
                <input
                  name="title"
                  value={submissionForm.title}
                  onChange={changeSubmissionField}
                  placeholder="예: 릴스 1차 시안"
                  style={inputStyle}
                  required
                />
              </FormField>

              <FormField label="설명">
                <textarea
                  name="description"
                  value={submissionForm.description}
                  onChange={changeSubmissionField}
                  placeholder="광고주에게 전달할 내용을 작성해 주세요."
                  rows={5}
                  style={textareaStyle}
                />
              </FormField>

              <FormField label="파일">
                <input
                  id="workspace-file"
                  name="file"
                  type="file"
                  onChange={changeSubmissionField}
                  required
                />
              </FormField>

              <button
                type="submit"
                disabled={uploading}
                style={primaryButtonStyle}
              >
                {uploading ? '업로드 중...' : '콘텐츠 제출'}
              </button>
            </form>
          )}

          <div style={{ marginTop: 28 }}>
            <h2>제출 내역</h2>

            {submissions.length === 0 ? (
              <div style={panelStyle}>
                아직 제출된 콘텐츠가 없습니다.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {submissions.map((item) => (
                  <article key={item.id} style={panelStyle}>
                    <div style={cardHeaderStyle}>
                      <div>
                        <span style={statusBadgeStyle}>
                          {CONTENT_STATUS_LABELS[item.status] ||
                            item.status}
                        </span>

                        <h3>{item.title}</h3>
                      </div>

                      <span style={mutedStyle}>
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>

                    {item.description && (
                      <p style={{ whiteSpace: 'pre-wrap' }}>
                        {item.description}
                      </p>
                    )}

                    {item.signed_url && (
                      <a
                        href={item.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.file_name || '제출 파일 열기'}
                      </a>
                    )}

                    {item.revision_message && (
                      <div style={revisionNoticeStyle}>
                        <strong>수정 요청</strong>
                        <p style={{ marginBottom: 0 }}>
                          {item.revision_message}
                        </p>
                      </div>
                    )}

                    {isAdvertiser &&
                      item.status !== 'approved' && (
                        <div style={buttonRowStyle}>
                          <button
                            type="button"
                            disabled={reviewingId === item.id}
                            onClick={() =>
                              reviewSubmission(
                                item.id,
                                'approved'
                              )
                            }
                            style={primaryButtonStyle}
                          >
                            승인
                          </button>

                          <button
                            type="button"
                            disabled={reviewingId === item.id}
                            onClick={() =>
                              reviewSubmission(
                                item.id,
                                'revision_requested'
                              )
                            }
                            style={secondaryButtonStyle}
                          >
                            수정 요청
                          </button>
                        </div>
                      )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'contract' && (
        <section>
          {isAdvertiser && (
            <form
              onSubmit={saveContract}
              style={panelStyle}
            >
              <h2 style={{ marginTop: 0 }}>
                계약서 작성
              </h2>

              <FormField label="계약 제목">
                <input
                  name="contractTitle"
                  value={contractForm.contractTitle}
                  onChange={changeContractField}
                  placeholder="예: 릴스 콘텐츠 제작 계약"
                  style={inputStyle}
                  required
                />
              </FormField>

              <FormField label="업무 범위">
                <textarea
                  name="workScope"
                  value={contractForm.workScope}
                  onChange={changeContractField}
                  placeholder="제작 콘텐츠, 게시 채널, 수정 횟수 등을 작성해 주세요."
                  rows={6}
                  style={textareaStyle}
                  required
                />
              </FormField>

              <div style={twoColumnStyle}>
                <FormField label="계약 금액">
                  <input
                    name="paymentAmount"
                    type="number"
                    min="0"
                    value={contractForm.paymentAmount}
                    onChange={changeContractField}
                    style={inputStyle}
                  />
                </FormField>

                <FormField label="납품 예정일">
                  <input
                    name="dueDate"
                    type="date"
                    value={contractForm.dueDate}
                    onChange={changeContractField}
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <FormField label="특약 사항">
                <textarea
                  name="specialTerms"
                  value={contractForm.specialTerms}
                  onChange={changeContractField}
                  rows={4}
                  style={textareaStyle}
                />
              </FormField>

              <button
                type="submit"
                disabled={savingContract}
                style={primaryButtonStyle}
              >
                {savingContract
                  ? '저장 중...'
                  : contract
                  ? '계약서 수정'
                  : '계약서 생성'}
              </button>
            </form>
          )}

          <div style={{ marginTop: 28 }}>
            {!contract ? (
              <div style={panelStyle}>
                <h3>아직 작성된 계약서가 없습니다.</h3>
                <p style={mutedStyle}>
                  광고주가 계약서를 작성하면 이곳에서 확인할 수
                  있습니다.
                </p>
              </div>
            ) : (
              <article style={panelStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <span style={statusBadgeStyle}>
                      {contract.status === 'completed'
                        ? '계약 완료'
                        : '동의 대기'}
                    </span>

                    <h2>{contract.contract_title}</h2>
                  </div>
                </div>

                <ContractItem
                  label="업무 범위"
                  value={contract.work_scope}
                />
                <ContractItem
                  label="계약 금액"
                  value={
                    contract.payment_amount
                      ? `${Number(
                          contract.payment_amount
                        ).toLocaleString()}원`
                      : '금액 협의'
                  }
                />
                <ContractItem
                  label="납품 예정일"
                  value={formatDate(contract.due_date)}
                />
                <ContractItem
                  label="특약 사항"
                  value={contract.special_terms || '없음'}
                />

                <div style={agreementGridStyle}>
                  <AgreementBox
                    label="광고주 동의"
                    agreed={contract.advertiser_agreed}
                    agreedAt={contract.advertiser_agreed_at}
                  />

                  <AgreementBox
                    label="크리에이터 동의"
                    agreed={contract.creator_agreed}
                    agreedAt={contract.creator_agreed_at}
                  />
                </div>

                {contract.status !== 'completed' &&
                  !(
                    (isAdvertiser &&
                      contract.advertiser_agreed) ||
                    (isCreator && contract.creator_agreed)
                  ) && (
                    <button
                      type="button"
                      disabled={agreeing}
                      onClick={agreeContract}
                      style={{
                        ...primaryButtonStyle,
                        marginTop: 20,
                      }}
                    >
                      {agreeing
                        ? '처리 중...'
                        : '계약 내용 확인 및 동의'}
                    </button>
                  )}

                {contract.status === 'completed' && (
                  <div style={completedContractStyle}>
                    양측 동의가 완료되어 계약이 체결되었습니다.
                  </div>
                )}
              </article>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label
        style={{
          display: 'block',
          marginBottom: 7,
          fontWeight: 700,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p style={eyebrowStyle}>{label}</p>
      <p style={{ margin: '6px 0 0', fontWeight: 700 }}>
        {value}
      </p>
    </div>
  );
}

function ContractItem({ label, value }) {
  return (
    <div style={contractItemStyle}>
      <strong>{label}</strong>
      <p
        style={{
          marginBottom: 0,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.7,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function AgreementBox({ label, agreed, agreedAt }) {
  return (
    <div style={agreementBoxStyle}>
      <strong>{label}</strong>
      <p
        style={{
          color: agreed ? '#047857' : '#92400e',
          fontWeight: 700,
        }}
      >
        {agreed ? '✓ 동의 완료' : '동의 대기'}
      </p>
      {agreedAt && (
        <span style={mutedStyle}>
          {formatDateTime(agreedAt)}
        </span>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return '일정 협의';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatTime(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const pageStyle = {
  maxWidth: 1050,
  margin: '0 auto',
  padding: '36px 22px 80px',
  color: '#111827',
};

const workspaceHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 20,
  flexWrap: 'wrap',
};

const summaryStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
  marginTop: 26,
  padding: 20,
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
};

const tabNavigationStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  margin: '28px 0 22px',
};

const tabButtonStyle = {
  border: '1px solid #d1d5db',
  background: '#ffffff',
  padding: '11px 18px',
  borderRadius: 9,
  cursor: 'pointer',
  fontWeight: 700,
};

const activeTabButtonStyle = {
  borderColor: '#6c5ce7',
  background: '#6c5ce7',
  color: '#ffffff',
};

const panelStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 24,
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
};

const chatBoxStyle = {
  height: 500,
  overflowY: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 20,
  background: '#ffffff',
};

const chatFormStyle = {
  display: 'flex',
  gap: 10,
  marginTop: 14,
};

const messageBubbleStyle = {
  maxWidth: '72%',
  padding: '11px 14px',
  borderRadius: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const messageMetaStyle = {
  marginTop: 6,
  fontSize: 11,
  opacity: 0.8,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 7,
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 9,
  border: '1px solid #d1d5db',
  fontSize: 15,
};

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
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

const noticeStyle = {
  marginBottom: 20,
  padding: 14,
  borderRadius: 10,
  background: '#f5f3ff',
  color: '#5b21b6',
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

const cardHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 14,
  flexWrap: 'wrap',
};

const buttonRowStyle = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 18,
};

const twoColumnStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
};

const revisionNoticeStyle = {
  marginTop: 16,
  padding: 14,
  borderRadius: 10,
  background: '#fff7ed',
  color: '#9a3412',
};

const agreementGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 24,
};

const agreementBoxStyle = {
  padding: 16,
  borderRadius: 10,
  background: '#f9fafb',
};

const contractItemStyle = {
  marginTop: 18,
  paddingTop: 18,
  borderTop: '1px solid #f0f0f0',
};

const completedContractStyle = {
  marginTop: 20,
  padding: 14,
  borderRadius: 10,
  background: '#ecfdf5',
  color: '#047857',
  fontWeight: 700,
};

const eyebrowStyle = {
  margin: 0,
  color: '#6b7280',
  fontSize: 13,
};

const mutedStyle = {
  color: '#6b7280',
  fontSize: 14,
};

const emptyMessageStyle = {
  textAlign: 'center',
  color: '#6b7280',
  marginTop: 40,
};
