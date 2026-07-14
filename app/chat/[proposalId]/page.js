'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default function ChatRoomPage() {
  const params = useParams();
  const proposalId = params?.proposalId;

  const [user, setUser] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  const bottomRef = useRef(null);

  useEffect(() => {
    loadChatRoom();
  }, [proposalId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    if (!proposalId || !user?.id) return;

    const channel = supabase
      .channel(`chat-room-${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          const newMessage = payload.new;

          setMessages((current) => {
            const alreadyExists = current.some(
              (message) => message.id === newMessage.id
            );

            if (alreadyExists) {
              return current;
            }

            return [...current, newMessage];
          });

          if (
            newMessage.receiver_id === user.id &&
            !newMessage.is_read
          ) {
            markMessageRead(newMessage.id);
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
          const updatedMessage = payload.new;

          setMessages((current) =>
            current.map((message) =>
              message.id === updatedMessage.id
                ? updatedMessage
                : message
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proposalId, user?.id]);

  async function loadChatRoom() {
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
        setNotice('로그인 후 채팅을 이용할 수 있습니다.');
        return;
      }

      setUser(currentUser);

      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select(
          `
          id,
          advertiser_id,
          creator_id,
          brand_name,
          title,
          status
        `
        )
        .eq('id', proposalId)
        .maybeSingle();

      if (proposalError) {
        throw proposalError;
      }

      if (!proposalData) {
        setNotice('협업 제안을 찾을 수 없습니다.');
        return;
      }

      const isParticipant =
        proposalData.advertiser_id === currentUser.id ||
        proposalData.creator_id === currentUser.id;

      if (!isParticipant) {
        setNotice('이 채팅방에 접근할 권한이 없습니다.');
        return;
      }

      if (proposalData.status !== 'accepted') {
        setNotice('수락된 협업 제안만 채팅할 수 있습니다.');
        setProposal(proposalData);
        return;
      }

      setProposal(proposalData);

      const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true });

      if (messageError) {
        throw messageError;
      }

      const loadedMessages = messageData || [];
      setMessages(loadedMessages);

      const unreadMessageIds = loadedMessages
        .filter(
          (chatMessage) =>
            chatMessage.receiver_id === currentUser.id &&
            !chatMessage.is_read
        )
        .map((chatMessage) => chatMessage.id);

      if (unreadMessageIds.length > 0) {
        const { error: readError } = await supabase
          .from('chat_messages')
          .update({
            is_read: true,
          })
          .in('id', unreadMessageIds)
          .eq('receiver_id', currentUser.id);

        if (readError) {
          console.error(readError);
        } else {
          setMessages((current) =>
            current.map((chatMessage) =>
              unreadMessageIds.includes(chatMessage.id)
                ? {
                    ...chatMessage,
                    is_read: true,
                  }
                : chatMessage
            )
          );
        }
      }
    } catch (error) {
      console.error(error);
      setNotice(
        error?.message || '채팅방 정보를 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }

  const receiverId = useMemo(() => {
    if (!proposal || !user) return null;

    return proposal.advertiser_id === user.id
      ? proposal.creator_id
      : proposal.advertiser_id;
  }, [proposal, user]);

  async function markMessageRead(messageId) {
    const { error } = await supabase
      .from('chat_messages')
      .update({
        is_read: true,
      })
      .eq('id', messageId)
      .eq('receiver_id', user.id);

    if (error) {
      console.error(error);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedMessage = input.trim();

    if (
      !trimmedMessage ||
      !user ||
      !receiverId ||
      !proposalId ||
      sending
    ) {
      return;
    }

    setSending(true);
    setNotice('');

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          proposal_id: proposalId,
          sender_id: user.id,
          receiver_id: receiverId,
          message: trimmedMessage,
          is_read: false,
        });

      if (error) {
        throw error;
      }

      setInput('');
    } catch (error) {
      console.error(error);
      setNotice(
        error?.message || '메시지 전송에 실패했습니다.'
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          채팅방을 불러오는 중입니다.
        </div>
      </main>
    );
  }

  if (!proposal || notice) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ color: '#dc2626' }}>{notice}</p>

          <Link href="/chat">채팅 목록으로 돌아가기</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <p
            style={{
              margin: 0,
              color: '#6b7280',
              fontSize: 13,
            }}
          >
            협업 채팅
          </p>

          <h1
            style={{
              margin: '6px 0 0',
              fontSize: 24,
            }}
          >
            {proposal.brand_name || '브랜드명 없음'}
          </h1>

          <p
            style={{
              margin: '6px 0 0',
              color: '#6b7280',
            }}
          >
            {proposal.title}
          </p>
        </div>

        <Link href="/chat">목록</Link>
      </div>

      <div style={chatBoxStyle}>
        {messages.length === 0 ? (
          <p
            style={{
              color: '#6b7280',
              textAlign: 'center',
              marginTop: 40,
            }}
          >
            아직 메시지가 없습니다.
          </p>
        ) : (
          messages.map((chatMessage) => {
            const isMine = chatMessage.sender_id === user.id;

            return (
              <div
                key={chatMessage.id}
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
                    maxWidth: '72%',
                    padding: '11px 14px',
                    borderRadius: 14,
                    background: isMine ? '#6c5ce7' : '#f3f4f6',
                    color: isMine ? '#ffffff' : '#111827',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  <div>{chatMessage.message}</div>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      opacity: 0.8,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 7,
                    }}
                  >
                    {isMine && (
                      <span>
                        {chatMessage.is_read ? '읽음' : '전송됨'}
                      </span>
                    )}

                    <span>
                      {formatTime(chatMessage.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="메시지를 입력하세요."
          disabled={sending}
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            ...buttonStyle,
            opacity: sending || !input.trim() ? 0.55 : 1,
          }}
        >
          {sending ? '전송 중...' : '전송'}
        </button>
      </form>

      {notice && (
        <p
          style={{
            color: '#dc2626',
            marginTop: 12,
          }}
        >
          {notice}
        </p>
      )}
    </main>
  );
}

function formatTime(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const pageStyle = {
  maxWidth: 900,
  margin: '40px auto',
  padding: 20,
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 20,
  marginBottom: 20,
};

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 24,
};

const chatBoxStyle = {
  height: 500,
  overflowY: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 20,
  background: '#ffffff',
};

const formStyle = {
  display: 'flex',
  gap: 10,
  marginTop: 16,
};

const inputStyle = {
  flex: 1,
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: 15,
};

const buttonStyle = {
  border: 'none',
  background: '#6c5ce7',
  color: '#ffffff',
  padding: '0 22px',
  borderRadius: 10,
  cursor: 'pointer',
  fontWeight: 700,
};
