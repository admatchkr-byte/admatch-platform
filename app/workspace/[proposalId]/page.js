'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import html2canvas from 'html2canvas';
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
  const [advertiserProfile, setAdvertiserProfile] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState(null);
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
    contentType: '',
    channelItems: [
      {
        channel: '',
        amount: '',
      },
    ],
    revisionCount: '2',
    secondaryUsage: '',
    discountAmount: '',
    settlementType: 'freelancer',
    paymentMethod: 'bank_transfer',
    taxInvoice: '',
  });
  const [savingContract, setSavingContract] = useState(false);
  const [agreeing, setAgreeing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const bottomRef = useRef(null);
  const contractRef = useRef(null);
  const exportContractRef = useRef(null);

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
      await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('user_id', currentUser.id)
  .eq('proposal_id', proposalId)
  .eq('type', 'chat')
  .eq('is_read', false);
      const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email, contact')
      .in('id', [
        proposalData.advertiser_id,
        proposalData.creator_id,
      ]);
    
    if (profilesError) {
      throw profilesError;
    }
    
    const advertiser =
      profilesData?.find(
        (profile) => profile.id === proposalData.advertiser_id
      ) || null;
    
    const creator =
      profilesData?.find(
        (profile) => profile.id === proposalData.creator_id
      ) || null;
    
    setAdvertiserProfile(advertiser);
    setCreatorProfile(creator);

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
  .eq('is_voided', false)
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
        contentType: data.content_type || '',
        channelItems:
        Array.isArray(data.channel_items) && data.channel_items.length > 0
          ? data.channel_items.map((item) => ({
              channel: item.channel || '',
              amount:
                item.amount !== null && item.amount !== undefined
                  ? String(item.amount)
                  : '',
            }))
          : [
              {
                channel: '',
                amount: '',
              },
            ],

        secondaryUsage: data.secondary_usage || '',
        discountAmount: data.discount_amount
          ? String(data.discount_amount)
          : '',
          settlementType: data.settlement_type || 'freelancer',
        paymentMethod: data.payment_method || 'bank_transfer',
        taxInvoice:
          data.tax_invoice === true
            ? 'issued'
            : data.tax_invoice === false
            ? 'not_issued'
            : '',
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
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: receiverId,
            proposal_id: proposalId,
            type: 'chat',
            title: '새 메시지가 도착했습니다.',
            message: message,
            is_read: false,
          });
      
        if (notificationError) {
          console.error('채팅 알림 생성 실패:', notificationError);
        }
      
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
    if (!isCreator) return;

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
  
  function changeChannelItem(index, field, value) {
    setContractForm((current) => {
      const nextItems = [...current.channelItems];
  
      nextItems[index] = {
        ...nextItems[index],
        [field]: value,
      };
  
      return {
        ...current,
        channelItems: nextItems,
      };
    });
  }
  
  function addChannelItem() {
    setContractForm((current) => {
      if (current.channelItems.length >= 5) {
        return current;
      }
  
      return {
        ...current,
        channelItems: [
          ...current.channelItems,
          {
            channel: '',
            amount: '',
          },
        ],
      };
    });
  }
  
  function removeChannelItem(index) {
    setContractForm((current) => {
      if (current.channelItems.length <= 1) {
        return current;
      }
  
      return {
        ...current,
        channelItems: current.channelItems.filter(
          (_, itemIndex) => itemIndex !== index
        ),
      };
    });
  }
  async function downloadContractImage() {
    if (!exportContractRef.current) return;
  
    try {
      const canvas = await html2canvas(exportContractRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
  
      const image = canvas.toDataURL('image/png', 1.0);
  
      const link = document.createElement('a');
      link.href = image;
      link.download = `광고잇다_계약서_${String(proposalId).slice(0, 8)}.png`;
  
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('계약서 이미지 저장 실패:', error);
      setNotice('계약서 이미지 저장에 실패했습니다.');
    }
  }
  
  async function saveContract(event) {
    event.preventDefault();
  
    if (!isCreator) return;
    if (
      contract &&
      (contract.advertiser_agreed || contract.creator_agreed)
    ) {
      setNotice(
        '한쪽이라도 계약에 동의한 이후에는 계약서를 수정할 수 없습니다. 변경이 필요하면 기존 계약서를 폐기하고 새로 작성해 주세요.'
      );
      return;
    }
  
    if (
      !contractForm.contractTitle.trim() ||
      !contractForm.workScope.trim()
    ) {
      setNotice('계약 제목과 협업 내용을 입력해 주세요.');
      return;
    }

    setSavingContract(true);
    setNotice('');
    const paymentAmount = contractForm.channelItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    
    const discountAmount = Number(contractForm.discountAmount || 0);
    
    const supplyAmount = Math.max(
      paymentAmount - discountAmount,
      0
    );
    
    const isFreelancer =
    contractForm.settlementType === 'freelancer';
  
  const withholdingAmount = isFreelancer
    ? Math.round(supplyAmount * 0.033)
    : 0;
  
  const vatAmount = !isFreelancer
    ? Math.round(supplyAmount * 0.1)
    : 0;
  
  const finalAmount = isFreelancer
    ? supplyAmount - withholdingAmount
    : supplyAmount + vatAmount;

    const payload = {
      proposal_id: proposalId,
      advertiser_id: proposal.advertiser_id,
      creator_id: proposal.creator_id,
    
      contract_title: contractForm.contractTitle.trim(),
      work_scope: contractForm.workScope.trim(),
      settlement_type: contractForm.settlementType,
    
      payment_amount: paymentAmount,
      discount_amount: discountAmount,
      vat_amount: vatAmount,
      withholding_amount: withholdingAmount,
      final_amount: finalAmount,

      due_date: contractForm.dueDate || null,
    
      special_terms:
        contractForm.specialTerms.trim() || null,
    
      content_type:
        contractForm.contentType.trim() || null,
    
     channel_items: contractForm.channelItems
  .filter((item) => item.channel.trim())
  .slice(0, 5)
  .map((item) => ({
    channel: item.channel.trim(),
    amount: item.amount ? Number(item.amount) : 0,
  })),
    
      revision_count: contractForm.revisionCount
        ? Number(contractForm.revisionCount)
        : 0,
    
      secondary_usage:
        contractForm.secondaryUsage.trim() || null,
    
      payment_method:
        contractForm.paymentMethod || null,
    
      tax_invoice:
        contractForm.paymentMethod === 'bank_transfer'
          ? contractForm.taxInvoice === 'issued'
            ? true
            : contractForm.taxInvoice === 'not_issued'
            ? false
            : null
          : null,
    
      status: 'waiting',
      updated_at: new Date().toISOString(),
    };

    let error;

if (contract) {
  const result = await supabase
    .from('contracts')
    .update(payload)
    .eq('id', contract.id);

  error = result.error;
} else {
  const result = await supabase
    .from('contracts')
    .insert(payload);

  error = result.error;
}

      if (error) {
        setNotice(error.message || '계약서 저장에 실패했습니다.');
      } else {
      
        await loadContract();
      
        setNotice(
          contract
            ? '계약서가 수정되었습니다.'
            : '계약서가 생성되었습니다.'
        );
      }

    setSavingContract(false);
  }
  async function voidContract() {
    if (!contract || !user || !isCreator) return;
  
    const confirmed = window.confirm(
      '이 계약서를 폐기하시겠습니까? 폐기 후에는 기존 계약서를 다시 사용할 수 없습니다.'
    );
  
    if (!confirmed) return;
  
    setNotice('');
  
    const now = new Date().toISOString();
  
    const { error: voidError } = await supabase
      .from('contracts')
      .update({
        is_voided: true,
        voided_at: now,
        updated_at: now,
      })
      .eq('id', contract.id);
  
    if (voidError) {
      console.error('계약서 폐기 실패:', voidError);
      setNotice(voidError.message || '계약서 폐기에 실패했습니다.');
      return;
    }
  
    const receiverId = proposal.advertiser_id;
  
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: receiverId,
        proposal_id: proposalId,
        type: 'contract_voided',
        title: '계약서가 폐기되었습니다.',
        message:
          '기존 계약서가 폐기되었습니다. 새로운 계약서가 작성되면 다시 확인해 주세요.',
        is_read: false,
      });
  
    if (notificationError) {
      console.error(
        '계약서 폐기 알림 생성 실패:',
        notificationError
      );
    }
  
    setContract(null);
  
    await loadContract();
  
    setNotice(
      '계약서가 폐기되었습니다. 새로운 계약서를 작성해 주세요.'
    );
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
                      <div
  style={{
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 5,
    opacity: 0.8,
  }}
>
  {item.sender_id === proposal.advertiser_id
    ? '광고주'
    : '크리에이터'}
</div>

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
          {isCreator && (
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

              <FormField label="협업 내용">
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

                <FormField label="업로드 예정일">
                  <input
                    name="dueDate"
                    type="date"
                    value={contractForm.dueDate}
                    onChange={changeContractField}
                    style={inputStyle}
                  />
                </FormField>
              </div>
              <div style={twoColumnStyle}>
  <FormField label="콘텐츠 유형">
    <input
      name="contentType"
      value={contractForm.contentType}
      onChange={changeContractField}
      placeholder="예: 인스타그램 릴스"
      style={inputStyle}
    />
  </FormField>

  <FormField label="업로드 채널 및 채널별 금액">
  <div style={{ display: 'grid', gap: 12 }}>
    {contractForm.channelItems.map((item, index) => (
      <div
        key={index}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 180px auto',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          value={item.channel}
          onChange={(event) =>
            changeChannelItem(
              index,
              'channel',
              event.target.value
            )
          }
          placeholder={`채널 ${index + 1} 예: 인스타그램 릴스`}
          style={inputStyle}
        />

        <input
          type="number"
          min="0"
          value={item.amount}
          onChange={(event) =>
            changeChannelItem(
              index,
              'amount',
              event.target.value
            )
          }
          placeholder="금액"
          style={inputStyle}
        />

        <button
          type="button"
          onClick={() => removeChannelItem(index)}
          disabled={contractForm.channelItems.length <= 1}
          style={secondaryButtonStyle}
        >
          삭제
        </button>
      </div>
    ))}

    <div>
      <button
        type="button"
        onClick={addChannelItem}
        disabled={contractForm.channelItems.length >= 5}
        style={secondaryButtonStyle}
      >
        + 채널 추가
      </button>

      <span
        style={{
          marginLeft: 10,
          color: '#6b7280',
          fontSize: 13,
        }}
      >
        최대 5개
      </span>
    </div>
  </div>
</FormField>

</div>

<div style={twoColumnStyle}>
  <FormField label="수정 가능 횟수">
    <input
      name="revisionCount"
      type="number"
      min="0"
      value={contractForm.revisionCount}
      onChange={changeContractField}
      style={inputStyle}
    />
  </FormField>

  <FormField label="할인 금액">
    <input
      name="discountAmount"
      type="number"
      min="0"
      value={contractForm.discountAmount}
      onChange={changeContractField}
      placeholder="0"
      style={inputStyle}
    />
  </FormField>
</div>

<FormField label="2차 활용 범위">
  <textarea
    name="secondaryUsage"
    value={contractForm.secondaryUsage}
    onChange={changeContractField}
    placeholder="예: 업체 SNS 업로드 허용, 유료 광고 활용 불가"
    rows={3}
    style={textareaStyle}
  />
</FormField>

<FormField label="정산 유형">
  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
    <label>
      <input
        type="radio"
        name="settlementType"
        value="freelancer"
        checked={contractForm.settlementType === 'freelancer'}
        onChange={changeContractField}
      />
      {' '}개인(프리랜서) - 3.3% 공제
    </label>

    <label>
      <input
        type="radio"
        name="settlementType"
        value="business"
        checked={contractForm.settlementType === 'business'}
        onChange={changeContractField}
      />
      {' '}사업자 - 세금계산서 발행
    </label>
  </div>
</FormField>

<FormField label="결제 방식">
  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
    <label>
      <input
        type="radio"
        name="paymentMethod"
        value="bank_transfer"
        checked={contractForm.paymentMethod === 'bank_transfer'}
        onChange={changeContractField}
      />
      {' '}계좌이체
    </label>

    <label>
      <input
        type="radio"
        name="paymentMethod"
        value="card"
        checked={contractForm.paymentMethod === 'card'}
        onChange={changeContractField}
      />
      {' '}카드결제
    </label>
  </div>
</FormField>

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
  disabled={
    savingContract ||
    Boolean(
      contract &&
      (contract.advertiser_agreed || contract.creator_agreed)
    )
  }
  style={{
    ...primaryButtonStyle,
    opacity:
      contract &&
      (contract.advertiser_agreed || contract.creator_agreed)
        ? 0.5
        : 1,
    cursor:
      contract &&
      (contract.advertiser_agreed || contract.creator_agreed)
        ? 'not-allowed'
        : 'pointer',
  }}
>
  {savingContract
    ? '저장 중...'
    : contract &&
      (contract.advertiser_agreed || contract.creator_agreed)
    ? '동의 후 수정 불가'
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
      크리에이터가 계약서를 작성하면 이곳에서 확인할 수 있습니다.
    </p>
  </div>
) : (
  <div style={contractPreviewWrapperStyle}>
 <article ref={contractRef} style={a4ContractStyle}>

        {/* 상단 로고 및 제목 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #1e3a8a',
            paddingBottom: 10,
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: '#111827',
                marginBottom: 8,
              }}
            >
              광고<span style={{ color: '#6c5ce7' }}>잇다</span>
            </div>
      
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: '#111827',
              }}
            >
              광고 콘텐츠 협업 계약서
            </h1>
          </div>
      
          <div
            style={{
              textAlign: 'right',
              fontSize: 12,
              lineHeight: 1.8,
              color: '#6b7280',
            }}
          >
            <div>
              계약번호
            </div>
      
            <strong style={{ color: '#111827' }}>
              {String(proposalId).slice(0, 8).toUpperCase()}
            </strong>
      
            <div style={{ marginTop: 6 }}>
              계약 상태
            </div>
      
            <strong
              style={{
                color:
                  contract.status === 'completed'
                    ? '#047857'
                    : '#92400e',
              }}
            >
              {contract.status === 'completed'
                ? '계약 체결 완료'
                : '계약 동의 진행 중'}
            </strong>
          </div>
        </div>
      
        {/* 광고주 / 크리에이터 정보 */}
        <div style={{ marginBottom: 14 }}>
          <h2
            style={{
              fontSize: 14,
              margin: '0 0 10px',
              color: '#1e3a8a',
            }}
          >
            계약 당사자 정보
          </h2>
      
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}
          >
            <tbody>
              <tr>
                <td
                  colSpan="2"
                  style={{
                    padding: 10,
                    background: '#eff6ff',
                    border: '1px solid #cbd5e1',
                    fontWeight: 800,
                    color: '#1e3a8a',
                  }}
                >
                  광고주 정보
                </td>
      
                <td
                  colSpan="2"
                  style={{
                    padding: 10,
                    background: '#eff6ff',
                    border: '1px solid #cbd5e1',
                    fontWeight: 800,
                    color: '#1e3a8a',
                  }}
                >
                  크리에이터 정보
                </td>
              </tr>
      
              <tr>
                <td
                  style={{
                    width: '14%',
                    padding: 10,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    fontWeight: 700,
                  }}
                >
                  브랜드명
                </td>
      
                <td
                  style={{
                    width: '36%',
                    padding: 10,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  {proposal.brand_name || '-'}
                </td>
      
                <td
                  style={{
                    width: '14%',
                    padding: 10,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    fontWeight: 700,
                  }}
                >
                  이름
                </td>
      
                <td
                  style={{
                    width: '36%',
                    padding: 10,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  {creatorProfile?.name || '-'}
                </td>
              </tr>
      
              <tr>
                <td
                  style={{
                    padding: 10,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    fontWeight: 700,
                  }}
                >
                  담당자
                </td>
      
                <td
                  style={{
                    padding: 10,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  {advertiserProfile?.name || '-'}
                </td>
      
                <td
                  style={{
                    padding: 10,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    fontWeight: 700,
                  }}
                >
                  연락처
                </td>
      
                <td
                  style={{
                    padding: 10,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  {creatorProfile?.contact || '-'}
                </td>
              </tr>
      
              <tr>
                <td
                  style={{
                    padding: 10,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    fontWeight: 700,
                  }}
                >
                  연락처
                </td>
      
                <td
                  style={{
                    padding: 10,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  {advertiserProfile?.contact || '-'}
                </td>
      
                <td
                  style={{
                    padding: 10,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    fontWeight: 700,
                  }}
                >
                  이메일
                </td>
      
                <td
                  style={{
                    padding: 10,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  {creatorProfile?.email || '-'}
                </td>
              </tr>
      
              <tr>
                <td
                  style={{
                    padding: 10,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    fontWeight: 700,
                  }}
                >
                  이메일
                </td>
      
                <td
                  style={{
                    padding: 10,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  {advertiserProfile?.email || '-'}
                </td>
      
                <td
                  style={{
                    padding: 10,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                  }}
                />
      
                <td
                  style={{
                    padding: 10,
                    border: '1px solid #cbd5e1',
                  }}
                />
              </tr>
            </tbody>
          </table>
        </div>
      
        {/* 계약 기본 정보 */}
        <div style={{ marginBottom: 14 }}>
          <h2
            style={{
              fontSize: 14,
              margin: '0 0 10px',
              color: '#1e3a8a',
            }}
          >
            계약 기본 정보
          </h2>
      
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}
          >
            <tbody>
              <tr>
                <td style={contractTableLabelStyle}>계약명</td>
                <td style={contractTableValueStyle}>
                  {contract.contract_title || '-'}
                </td>
      
                <td style={contractTableLabelStyle}>콘텐츠 유형</td>
                <td style={contractTableValueStyle}>
                  {contract.content_type || '-'}
                </td>
              </tr>
      
              <tr>
                <td style={contractTableLabelStyle}>업로드 채널</td>
                <td style={contractTableValueStyle}>
                {Array.isArray(contract.channel_items) &&
contract.channel_items.length > 0
  ? contract.channel_items
      .map((item) => item.channel)
      .join(', ')
  : '-'}
                </td>
      
                <td style={contractTableLabelStyle}>업로드 예정일</td>
                <td style={contractTableValueStyle}>
                  {formatDate(contract.due_date)}
                </td>
              </tr>
      
              <tr>
                <td style={contractTableLabelStyle}>수정 가능 횟수</td>
                <td style={contractTableValueStyle}>
                  {contract.revision_count ?? 0}회
                </td>
      
                <td style={contractTableLabelStyle}>2차 활용</td>
                <td style={contractTableValueStyle}>
                  {contract.secondary_usage || '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      
        {/* 협업 내용 */}
        <div style={{ marginBottom: 14 }}>
          <h2
            style={{
              fontSize: 14,
              margin: '0 0 10px',
              color: '#1e3a8a',
            }}
          >
            협업 내용
          </h2>
      
          <div
            style={{
              padding: 8,
              border: '1px solid #cbd5e1',
              minHeight: 36,
              fontSize: 11,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {contract.work_scope || '-'}
          </div>
        </div>
      
        {/* 비용 내역 */}
<div style={{ marginBottom: 14 }}>
  <h2
    style={{
      fontSize: 14,
      margin: '0 0 10px',
      color: '#1e3a8a',
    }}
  >
    비용 내역
  </h2>

  <table
    style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13,
    }}
  >
    <tbody>
      {Array.isArray(contract.channel_items) &&
        contract.channel_items.map((item, index) => (
          <tr key={index}>
            <td style={contractTableLabelStyle}>
              {item.channel || `채널 ${index + 1}`}
            </td>

            <td style={contractTableValueStyle}>
              {Number(item.amount || 0).toLocaleString()}원
            </td>
          </tr>
        ))}

{Number(contract.discount_amount || 0) > 0 && (
  <tr>
    <td style={contractTableLabelStyle}>할인 금액</td>
    <td style={contractTableValueStyle}>
      {Number(contract.discount_amount || 0).toLocaleString()}원
    </td>
  </tr>
)}

<tr>
  <td
    style={{
      ...contractTableLabelStyle,
      borderTop: '3px solid #1e3a8a',
      background: '#f8fafc',
      fontWeight: 800,
    }}
  >
    총 금액
  </td>

  <td
    style={{
      ...contractTableValueStyle,
      borderTop: '3px solid #1e3a8a',
      background: '#f8fafc',
      fontWeight: 800,
    }}
  >
    {Number(
      (contract.payment_amount || 0) -
      (contract.discount_amount || 0)
    ).toLocaleString()}원
  </td>
</tr>

{contract.settlement_type === 'freelancer' ? (
  <tr>
    <td
      style={{
        ...contractTableLabelStyle,
        background: '#f8fafc',
      }}
    >
      3.3% 공제
    </td>

    <td
      style={{
        ...contractTableValueStyle,
        background: '#f8fafc',
      }}
    >
      -{Number(contract.withholding_amount || 0).toLocaleString()}원
    </td>
  </tr>
) : (
  <tr>
    <td
      style={{
        ...contractTableLabelStyle,
        background: '#f8fafc',
      }}
    >
      부가세 (10%)
    </td>

    <td
      style={{
        ...contractTableValueStyle,
        background: '#f8fafc',
      }}
    >
      {Number(contract.vat_amount || 0).toLocaleString()}원
    </td>
  </tr>
)}

<tr>
  <td
    style={{
      ...contractTableLabelStyle,
      background: '#eff6ff',
      color: '#1e3a8a',
      fontWeight: 800,
    }}
  >
    {contract.settlement_type === 'freelancer'
  ? '실지급 금액'
  : '최종 결제 금액'}
  </td>

  <td
    style={{
      ...contractTableValueStyle,
      background: '#eff6ff',
      color: '#1e3a8a',
      fontWeight: 900,
      fontSize: 18,
    }}
  >
    {Number(contract.final_amount || 0).toLocaleString()}원
  </td>
</tr>
    </tbody>
  </table>
</div>
      
        {/* 결제 방식 */}
        <div style={{ marginBottom: 14 }}>
          <h2
            style={{
              fontSize: 14,
              margin: '0 0 10px',
              color: '#1e3a8a',
            }}
          >
            결제 방식
          </h2>
      
          <div
            style={{
              padding: 16,
              border: '1px solid #cbd5e1',
              fontSize: 14,
              lineHeight: 2,
            }}
          >
            <strong>
              {contract.payment_method === 'card'
                ? '☑ 카드결제'
                : '☑ 계좌이체'}
            </strong>
      
          </div>
        </div>
      
        {/* 계약 조건 */}
        <div style={{ marginBottom: 14 }}>
          <h2
            style={{
              fontSize: 14,
              margin: '0 0 10px',
              color: '#1e3a8a',
            }}
          >
            계약 조건
          </h2>
      
          <div
            style={{
              border: '1px solid #cbd5e1',
              padding: 8,
              fontSize: 10,
              lineHeight: 1.4,
            }}
          >
           <p style={{ margin: '0 0 4px' }}>
  1. 크리에이터는 상호 합의 협업 내용 및 일정에 따라 콘텐츠를 제작하고 제출합니다.
</p>

<p style={{ margin: '0 0 4px' }}>
  2. 광고주는 계약된 범위 내에서 콘텐츠의 검수 및 수정을 요청할 수 있습니다.
</p>

<p style={{ margin: '0 0 4px' }}>
  3. 계약 범위를 초과하는 추가 제작 및 재촬영은 양측 협의에 따라 별도의 비용이 발생할 수 있습니다.
</p>

<p style={{ margin: 0 }}>
  4. 콘텐츠의 저작권 및 2차 활용 범위는 본 계약서에 기재된 내용과 양측의 별도 합의에 따릅니다.
</p>
          </div>
        </div>
      
        {/* 특약 사항 */}
        <div style={{ marginBottom: 14 }}>
          <h2
            style={{
              fontSize: 17,
              margin: '0 0 10px',
              color: '#1e3a8a',
            }}
          >
            특약 사항
          </h2>
      
          <div
            style={{
              minHeight: 36,
              padding: 8,
              border: '1px solid #cbd5e1',
              fontSize: 11,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {contract.special_terms ||
              '별도의 특약 사항이 없습니다.'}
          </div>
        </div>
      
        {/* 계약 동의 */}
        <div
          style={{
            borderTop: '2px solid #1e3a8a',
            paddingTop: 10,
          }}
        >
          <p
            style={{
              textAlign: 'center',
              fontSize: 14,
              lineHeight: 1.8,
              marginBottom: 10,
            }}
          >
            광고주와 크리에이터는 위 계약 내용을 충분히 확인하였으며
            이에 동의합니다.
          </p>
      
          <div style={signatureGridStyle}>
            <div style={signatureBoxStyle}>
              <span style={contractLabelStyle}>
                광고주
              </span>
      
              <strong>
                {advertiserProfile?.name ||
                  proposal.brand_name ||
                  '광고주'}
              </strong>
      
              <div style={{ marginTop: 10 }}>
                {contract.advertiser_agreed
                  ? '✓ 동의 완료'
                  : '동의 대기'}
              </div>
      
              {contract.advertiser_agreed_at && (
                <span style={signatureDateStyle}>
                  {formatDateTime(
                    contract.advertiser_agreed_at
                  )}
                </span>
              )}
            </div>
      
            <div style={signatureBoxStyle}>
              <span style={contractLabelStyle}>
                크리에이터
              </span>
      
              <strong>
                {creatorProfile?.name || '크리에이터'}
              </strong>
      
              <div style={{ marginTop: 10 }}>
                {contract.creator_agreed
                  ? '✓ 동의 완료'
                  : '동의 대기'}
              </div>
      
              {contract.creator_agreed_at && (
                <span style={signatureDateStyle}>
                  {formatDateTime(
                    contract.creator_agreed_at
                  )}
                </span>
              )}
            </div>
          </div>
      
          <div
            style={{
              textAlign: 'center',
              marginTop: 40,
              fontWeight: 900,
              fontSize: 20,
            }}
          >
            광고<span style={{ color: '#6c5ce7' }}>잇다</span>
          </div>
        </div>

      </article>

  {/* 이미지 저장 전용 A4 계약서 */}
<div
 ref={exportContractRef}
style={{
  position: 'fixed',
  left: '-10000px',
  top: 0,
  width: '210mm',
  height: '297mm',
  padding: '9mm 10mm 7mm',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#111827',
  fontFamily: 'Arial, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}}
>
{/* 상단 */}
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '2px solid #1e3a8a',
    paddingBottom: 8,
    marginBottom: 10,
  }}
>
  <div>
    <div
      style={{
        fontSize: 17,
        fontWeight: 900,
        marginBottom: 5,
      }}
    >
      광고<span style={{ color: '#6c5ce7' }}>잇다</span>
    </div>

    <div
      style={{
        fontSize: 23,
        fontWeight: 900,
      }}
    >
      광고 콘텐츠 협업 계약서
    </div>
  </div>

  <div
    style={{
      textAlign: 'right',
      fontSize: 10,
      lineHeight: 1.7,
      color: '#6b7280',
    }}
  >
    <div>계약번호</div>
    <strong style={{ color: '#111827' }}>
      {String(proposalId).slice(0, 8).toUpperCase()}
    </strong>

    <div style={{ marginTop: 3 }}>계약 상태</div>

    <strong style={{ color: '#92400e' }}>
      {contract.status === 'completed'
        ? '계약 체결 완료'
        : '계약 동의 진행 중'}
    </strong>
  </div>
</div>

{/* 1. 계약 당사자 */}
<div style={{ marginBottom: 9 }}>
  <div style={exportSectionTitleStyle}>1. 계약 당사자 정보</div>

  <table style={exportTableStyle}>
    <tbody>
      <tr>
        <td
          colSpan="2"
          style={{
            ...exportHeaderCellStyle,
            color: '#1e3a8a',
          }}
        >
          광고주 정보
        </td>

        <td
          colSpan="2"
          style={{
            ...exportHeaderCellStyle,
            color: '#1e3a8a',
          }}
        >
          크리에이터 정보
        </td>
      </tr>

      <tr>
        <td style={exportLabelCellStyle}>브랜드명</td>
        <td style={exportValueCellStyle}>
          {proposal.brand_name || '-'}
        </td>

        <td style={exportLabelCellStyle}>이름</td>
        <td style={exportValueCellStyle}>
          {creatorProfile?.name || '-'}
        </td>
      </tr>

      <tr>
        <td style={exportLabelCellStyle}>담당자</td>
        <td style={exportValueCellStyle}>
          {advertiserProfile?.name || '-'}
        </td>

        <td style={exportLabelCellStyle}>연락처</td>
        <td style={exportValueCellStyle}>
          {creatorProfile?.contact || '-'}
        </td>
      </tr>

      <tr>
        <td style={exportLabelCellStyle}>연락처</td>
        <td style={exportValueCellStyle}>
          {advertiserProfile?.contact || '-'}
        </td>

        <td style={exportLabelCellStyle}>이메일</td>
        <td style={exportValueCellStyle}>
          {creatorProfile?.email || '-'}
        </td>
      </tr>

      <tr>
        <td style={exportLabelCellStyle}>이메일</td>
        <td style={exportValueCellStyle}>
          {advertiserProfile?.email || '-'}
        </td>

        <td style={exportLabelCellStyle}></td>
        <td style={exportValueCellStyle}></td>
      </tr>
    </tbody>
  </table>
</div>

{/* 2. 계약 기본 정보 */}
<div style={{ marginBottom: 9 }}>
  <div style={exportSectionTitleStyle}>2. 계약 기본 정보</div>

  <table style={exportTableStyle}>
    <tbody>
      <tr>
        <td style={exportLabelCellStyle}>계약명</td>
        <td style={exportValueCellStyle}>
          {contract.contract_title || '-'}
        </td>

        <td style={exportLabelCellStyle}>콘텐츠 유형</td>
        <td style={exportValueCellStyle}>
          {contract.content_type || '-'}
        </td>
      </tr>

      <tr>
        <td style={exportLabelCellStyle}>업로드 채널</td>
        <td style={exportValueCellStyle}>
          {Array.isArray(contract.channel_items)
            ? contract.channel_items
                .map((item) => item.channel)
                .join(', ')
            : '-'}
        </td>

        <td style={exportLabelCellStyle}>업로드 예정일</td>
        <td style={exportValueCellStyle}>
          {formatDate(contract.due_date)}
        </td>
      </tr>

      <tr>
        <td style={exportLabelCellStyle}>수정 가능 횟수</td>
        <td style={exportValueCellStyle}>
          {contract.revision_count ?? 0}회
        </td>

        <td style={exportLabelCellStyle}>2차 활용</td>
        <td style={exportValueCellStyle}>
          {contract.secondary_usage || '-'}
        </td>
      </tr>
    </tbody>
  </table>
</div>

{/* 3. 협업 내용 */}
<div style={{ marginBottom: 9 }}>
  <div style={exportSectionTitleStyle}>3. 협업 내용</div>

  <div style={exportBoxStyle}>
    {contract.work_scope || '-'}
  </div>
</div>

{/* 4. 비용 */}
<div style={{ marginBottom: 9 }}>
  <div style={exportSectionTitleStyle}>4. 비용 내역</div>

  <table style={exportTableStyle}>
    <tbody>
      {Array.isArray(contract.channel_items) &&
        contract.channel_items.map((item, index) => (
          <tr key={index}>
            <td style={exportLabelCellStyle}>
              {item.channel || `채널 ${index + 1}`}
            </td>

            <td style={exportValueCellStyle}>
              {Number(item.amount || 0).toLocaleString()}원
            </td>
          </tr>
        ))}

      <tr>
        <td style={exportLabelCellStyle}>계약 금액</td>
        <td style={exportValueCellStyle}>
          {Number(contract.payment_amount || 0).toLocaleString()}원
        </td>
      </tr>

      <tr>
  <td
    style={{
      ...exportLabelCellStyle,
      borderTop: '3px solid #1e3a8a',
      background: '#f8fafc',
      fontWeight: 800,
    }}
  >
    총 금액
  </td>

  <td
    style={{
      ...exportValueCellStyle,
      borderTop: '3px solid #1e3a8a',
      background: '#f8fafc',
      fontWeight: 800,
    }}
  >
    {Number(
      (contract.payment_amount || 0) -
      (contract.discount_amount || 0)
    ).toLocaleString()}원
  </td>
</tr>

{contract.settlement_type === 'freelancer' ? (
  <tr>
    <td
      style={{
        ...exportLabelCellStyle,
        background: '#f8fafc',
      }}
    >
      3.3% 공제
    </td>

    <td
      style={{
        ...exportValueCellStyle,
        background: '#f8fafc',
      }}
    >
      -{Number(contract.withholding_amount || 0).toLocaleString()}원
    </td>
  </tr>
) : (
  <tr>
    <td
      style={{
        ...exportLabelCellStyle,
        background: '#f8fafc',
      }}
    >
      부가세 (10%)
    </td>

    <td
      style={{
        ...exportValueCellStyle,
        background: '#f8fafc',
      }}
    >
      {Number(contract.vat_amount || 0).toLocaleString()}원
    </td>
  </tr>
)}

<tr>
  <td
    style={{
      ...exportLabelCellStyle,
      background: '#eff6ff',
      color: '#1e3a8a',
      fontWeight: 900,
    }}
  >
    {contract.settlement_type === 'freelancer'
  ? '실지급 금액'
  : '최종 결제 금액'}
  </td>

  <td
    style={{
      ...exportValueCellStyle,
      background: '#eff6ff',
      color: '#1e3a8a',
      fontWeight: 900,
      fontSize: 15,
    }}
  >
    {Number(contract.final_amount || 0).toLocaleString()}원
  </td>
</tr>
    </tbody>
  </table>
</div>

{/* 5 + 6 가로 배치 */}
<div
  style={{
    display: 'grid',
    gridTemplateColumns: '0.75fr 1.7fr',
    gap: 10,
    marginBottom: 9,
  }}
>
  <div>
    <div style={exportSectionTitleStyle}>5. 결제 방식</div>

    <div
      style={{
        ...exportBoxStyle,
        minHeight: 58,
        fontWeight: 700,
      }}
    >
      {contract.payment_method === 'card'
        ? '☑ 카드결제'
        : '☑ 계좌이체'}
    </div>
  </div>

  <div>
    <div style={exportSectionTitleStyle}>6. 계약 조건</div>

    <div
      style={{
        ...exportBoxStyle,
        minHeight: 58,
        fontSize: 9,
        lineHeight: 1.45,
      }}
    >
      <div>1. 크리에이터는 합의된 협업 내용과 일정에 따라 콘텐츠를 제작·제출합니다.</div>
      <div>2. 광고주는 계약 범위 내에서 콘텐츠 검수 및 수정을 요청할 수 있습니다.</div>
      <div>3. 추가 제작 및 재촬영은 양측 협의에 따라 별도 비용이 발생할 수 있습니다.</div>
      <div>4. 저작권 및 2차 활용은 계약 내용과 양측의 별도 합의에 따릅니다.</div>
    </div>
  </div>
</div>

{/* 7. 특약 */}
<div style={{ marginBottom: 8 }}>
  <div style={exportSectionTitleStyle}>7. 특약 사항</div>

  <div style={exportBoxStyle}>
    {contract.special_terms || '별도의 특약 사항이 없습니다.'}
  </div>
</div>

{/* 서명 영역은 맨 아래 */}
<div
  style={{
    marginTop: 'auto',
    borderTop: '2px solid #1e3a8a',
    paddingTop: 8,
  }}
>
  <div
    style={{
      textAlign: 'center',
      fontSize: 10,
      marginBottom: 8,
    }}
  >
    광고주와 크리에이터는 위 계약 내용을 충분히 확인하였으며 이에 동의합니다.
  </div>

  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 30,
    }}
  >
    <div style={exportSignatureStyle}>
      <div style={{ color: '#6b7280', fontSize: 9 }}>
        광고주
      </div>

      <strong>
        {advertiserProfile?.name ||
          proposal.brand_name ||
          '광고주'}
      </strong>

      <div style={{ marginTop: 5 }}>
        {contract.advertiser_agreed
          ? '✓ 동의 완료'
          : '동의 대기'}
      </div>

      <div style={{ marginTop: 4, fontSize: 8, color: '#6b7280' }}>
        {contract.advertiser_agreed_at
          ? formatDateTime(contract.advertiser_agreed_at)
          : ''}
      </div>
    </div>

    <div style={exportSignatureStyle}>
      <div style={{ color: '#6b7280', fontSize: 9 }}>
        크리에이터
      </div>

      <strong>
        {creatorProfile?.name || '크리에이터'}
      </strong>

      <div style={{ marginTop: 5 }}>
        {contract.creator_agreed
          ? '✓ 동의 완료'
          : '동의 대기'}
      </div>

      <div style={{ marginTop: 4, fontSize: 8, color: '#6b7280' }}>
        {contract.creator_agreed_at
          ? formatDateTime(contract.creator_agreed_at)
          : ''}
      </div>
    </div>
  </div>

  <div
    style={{
      textAlign: 'center',
      fontWeight: 900,
      fontSize: 16,
      marginTop: 8,
    }}
  >
    광고<span style={{ color: '#6c5ce7' }}>잇다</span>
  </div>
</div>
</div>

  {/* 계약 동의 버튼 */}
  {contract.status !== 'completed' &&
    !(
      (isAdvertiser && contract.advertiser_agreed) ||
      (isCreator && contract.creator_agreed)
    ) && (
      <button
  type="button"
  onClick={downloadContractImage}
  style={{
    ...secondaryButtonStyle,
    marginTop: 16,
  }}
>
  계약서 이미지 저장
</button>
)}

{/* 계약 동의 버튼 */}
{contract.status !== 'completed' &&
  !(
    (isAdvertiser && contract.advertiser_agreed) ||
    (isCreator && contract.creator_agreed)
  ) && (
    <button
      type="button"
      disabled={agreeing}
      onClick={agreeContract}
      style={{
        ...primaryButtonStyle,
        marginTop: 24,
      }}
    >
      {agreeing
        ? '처리 중...'
        : '계약 내용 확인 및 동의'}
    </button>
  )}

{/* 계약서 폐기 버튼 */}
{isCreator &&
  contract &&
  !contract.is_voided &&
  (contract.advertiser_agreed || contract.creator_agreed) && (
    <button
      type="button"
      onClick={voidContract}
      style={{
        ...secondaryButtonStyle,
        marginTop: 12,
        borderColor: '#dc2626',
        color: '#dc2626',
      }}
    >
      계약서 폐기
    </button>
  )}

{contract.status === 'completed' && (
  <div style={completedContractStyle}>
    ✓ 광고주와 크리에이터의 동의가 완료되어 계약이 체결되었습니다.
  </div>
)}

</div>
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
function ContractSection({ title, children }) {
  return (
    <section
      style={{
        marginTop: 26,
      }}
    >
      <h2
        style={{
          margin: '0 0 10px',
          paddingBottom: 8,
          borderBottom: '1px solid #d1d5db',
          fontSize: 16,
        }}
      >
        {title}
      </h2>

      {children}
    </section>
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
const contractPreviewWrapperStyle = {
  marginTop: 28,
  padding: '40px 20px',
  background: '#eef0f3',
  borderRadius: 14,
  textAlign: 'center',
};

const a4ContractStyle = {
  width: '210mm',
  minHeight: '297mm',
  margin: '0 auto',
  padding: '10mm 10mm 8mm',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#111827',
  textAlign: 'left',
  boxShadow: '0 10px 35px rgba(0,0,0,0.12)',
  minHeight: '297mm',
};

const contractInfoBoxStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
  padding: '16px 18px',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  marginBottom: 30,
};

const contractPartyGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const contractPartyBoxStyle = {
  padding: 16,
  border: '1px solid #d1d5db',
};

const contractLabelStyle = {
  display: 'block',
  marginBottom: 6,
  color: '#6b7280',
  fontSize: 12,
};

const contractTextStyle = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.9,
  whiteSpace: 'pre-wrap',
};

const contractHighlightStyle = {
  margin: '0 0 8px',
  fontSize: 19,
  fontWeight: 800,
};

const signatureGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 18,
};

const signatureBoxStyle = {
  minHeight: 55,
  padding: 8,
  textAlign: 'center',
  borderBottom: '1px solid #111827',
};

const signatureDateStyle = {
  display: 'block',
  marginTop: 8,
  color: '#6b7280',
  fontSize: 12,
};
const contractTableLabelStyle = {
  padding: 7,
  background: '#f8fafc',
  border: '1px solid #cbd5e1',
  fontWeight: 700,
  width: '18%',
};

const contractTableValueStyle = {
  padding: 7,
  border: '1px solid #cbd5e1',
  width: '32%',
};

const exportSectionTitleStyle = {
  fontSize: 12,
  fontWeight: 900,
  color: '#1e3a8a',
  marginBottom: 5,
};

const exportTableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  fontSize: 10,
};

const exportHeaderCellStyle = {
  padding: 6,
  background: '#eff6ff',
  border: '1px solid #cbd5e1',
  fontWeight: 900,
};

const exportLabelCellStyle = {
  width: '18%',
  padding: 5,
  background: '#f8fafc',
  border: '1px solid #cbd5e1',
  fontWeight: 700,
  verticalAlign: 'middle',
};

const exportValueCellStyle = {
  padding: 5,
  border: '1px solid #cbd5e1',
  verticalAlign: 'middle',
  wordBreak: 'break-word',
};

const exportBoxStyle = {
  padding: 7,
  border: '1px solid #cbd5e1',
  minHeight: 24,
  fontSize: 10,
  lineHeight: 1.4,
  boxSizing: 'border-box',
};

const exportSignatureStyle = {
  textAlign: 'center',
  padding: '5px 10px',
  borderBottom: '1px solid #111827',
  fontSize: 10,
};