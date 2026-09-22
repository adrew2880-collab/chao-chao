'use client';

import { useEffect, useState } from 'react';
import { useRoomDoc } from '@/hooks/useRoomDoc';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useLeaveOnUnload } from '@/hooks/useLeaveOnUnload';
import { RoomService } from '@/services/roomService';

/* =========================================================================
 *  WAITING ROOM (대기실)
 *  방 생성/참여 직후 바로 게임으로 들어가지 않고 여기서 인원이 모이길 기다린다.
 *
 *  이제 useRoomDoc(roomId)으로 Firestore 방 문서를 실시간 구독하므로, 다른 기기에서
 *  실제로 누군가 방에 들어오면(participants 배열이 늘어나면) 이 화면이 폴링 없이
 *  즉시 갱신된다 — 예전의 "서버 연동 전에는 늘어나지 않습니다" 안내는 실제 서버
 *  연동이 끝났으므로 완전히 삭제했다.
 *
 *  방장(0번 좌석)이 [게임 시작]을 누르면 서버가 방 문서를 status:'playing'으로
 *  바꾸는데, 방에 있는 모든 클라이언트가 각자 이 구독을 통해 그 변화를 감지하고
 *  자동으로(누가 눌렀는지와 무관하게 전원) onStart를 호출해 게임 화면으로 넘어간다.
 * ========================================================================= */
export function WaitingRoom({
  roomId,
  myName,
  myPlayerId,
  onStart,
  onCancel,
}: {
  roomId: string;
  myName: string;
  myPlayerId: number;
  onStart: () => void;
  onCancel: () => void;
}) {
  const { room, loading, error } = useRoomDoc(roomId);
  const [draft, setDraft] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // 유령 방 청소 관련: 이 대기실을 열어둔 동안 주기적으로 살아있음을 알리고
  // (하트비트), 탭을 닫거나 사이트를 벗어나면 자동으로 이탈 처리되도록 등록한다.
  useHeartbeat(roomId);
  useLeaveOnUnload(roomId, myPlayerId);

  // 방 상태가 'playing'으로 바뀌는 순간(누가 시작시켰든) 이 방에 있는 모든 클라이언트가
  // 자동으로 게임 화면으로 넘어간다 — 대기실에 모여 있던 모두가 동시에 입장하게 된다.
  useEffect(() => {
    if (room?.status === 'playing') onStart();
  }, [room?.status, onStart]);

  // "← 로비로" 버튼: 탭을 닫는 게 아니라 화면 안에서 명시적으로 나가는 경우라
  // useLeaveOnUnload(pagehide/beforeunload)가 발동하지 않는다 — 그래서 여기서
  // 직접 leaveRoom을 호출한다. 실패해도 로비 화면 전환 자체는 막지 않는다.
  function handleCancel() {
    RoomService.leaveRoom(roomId, myPlayerId).catch((err) => {
      console.error('[WaitingRoom] 나가기 처리 실패:', err);
    });
    onCancel();
  }

  async function sendChat() {
    if (!draft.trim()) return;
    const me = { name: myName && myName.trim() ? myName.trim() : '나', emoji: room?.participants[myPlayerId]?.emoji ?? '' };
    const text = draft.trim();
    setDraft('');
    try {
      await RoomService.sendLobbyChat(roomId, me, text);
    } catch (err) {
      console.error('[WaitingRoom] 채팅 전송 실패:', err);
    }
  }

  async function handleStart() {
    setStarting(true);
    setStartError(null);
    try {
      await RoomService.startGame(roomId);
      // 성공하면 이 클라이언트도 위 useEffect(구독)를 통해 곧 onStart()가 호출된다 —
      // 여기서 직접 onStart()를 부르지 않는 이유는, 방장이 아닌 다른 참가자들과 똑같은
      // 경로(status 변화 감지)로 게임에 들어가게 해서 동작을 하나로 통일하기 위함이다.
    } catch (err) {
      setStartError(err instanceof Error ? err.message : '게임 시작에 실패했습니다.');
      setStarting(false);
    }
  }

  if (loading) {
    return <div className="lobby-shell"><p className="mono" style={{ padding: '2rem' }}>대기실 정보를 불러오는 중…</p></div>;
  }
  if (error || !room) {
    return (
      <div className="lobby-shell">
        <p className="mono" style={{ padding: '2rem' }}>{error || '존재하지 않는 방입니다.'}</p>
        <button className="pill-btn ghost small" onClick={handleCancel}>← 로비로</button>
      </div>
    );
  }

  // 나간(left:true) 참가자는 화면에서 숨긴다 — 단, 배열 인덱스(=좌석 번호=myPlayerId)는
  // 반드시 원본 그대로 유지해야 한다(join/leave 라우트 주석 참고). filter만 쓰면
  // 배열이 압축되면서 인덱스가 밀려 "나"/"방장" 라벨이 엉뚱한 사람에게 붙는 버그가
  // 생기므로, 먼저 원래 인덱스를 seat 필드에 담아둔 뒤에 필터링한다.
  const participants = room.participants.map((p, seat) => ({ ...p, seat })).filter((p) => !p.left);
  const count = participants.length;
  const isHost = myPlayerId === 0; // 0번 좌석(방을 만든 사람)만 게임 시작 권한을 가진다.
  const canStart = isHost && count >= 2; // 최소 2명이 모였을 때만 시작 가능

  return (
    <div className="lobby-shell">
      <div className="lobby-topbar">
        <div className="brand">
          <h1 className="display" style={{ fontSize: '2.1rem' }}>🚪 {room.name}</h1>
          <div className="tagline">플레이어를 기다리는 중… (최소 2명이 모여야 시작할 수 있어요)</div>
        </div>
        <button className="pill-btn ghost small" onClick={handleCancel}>← 로비로</button>
      </div>

      {startError && <p className="mono" style={{ color: 'var(--rust)', maxWidth: 1180, margin: '0 auto .6rem' }}>⚠️ {startError}</p>}

      <div className="lobby-grid">
        <div className="card form-card">
          <h3 className="panel-title"><span className="tag">{count}/4</span>참가자</h3>
          <div className="wr-list">
            {participants.map((p) => {
              const labels = [p.seat === 0 ? '방장' : null, p.seat === myPlayerId ? '나' : null].filter(Boolean);
              return (
                <div className="wr-row" key={p.seat}>
                  <div className="totem">{p.emoji}</div>
                  <div>{p.name}{labels.length ? ` (${labels.join(', ')})` : ''}</div>
                </div>
              );
            })}
            {count < 4 && <div className="wr-row wr-empty">⏳ 다른 플레이어를 기다리는 중…</div>}
          </div>
          {isHost ? (
            <button className="pill-btn" disabled={!canStart || starting} onClick={handleStart}>
              {starting ? '시작하는 중…' : canStart ? `▶ 게임 시작 (${count}인)` : '2명 이상 모여야 시작할 수 있어요'}
            </button>
          ) : (
            <p className="mono" style={{ fontSize: '.8rem', color: 'var(--ink-dim)' }}>⏳ 방장이 게임을 시작하길 기다리는 중…</p>
          )}
        </div>

        <div className="card wr-chat-card">
          <h3 className="panel-title"><span className="tag">CHAT</span>대기실 채팅</h3>
          <div className="chat-log">
            {room.lobbyChat.map((m) => (
              <div key={m.id} className={'chat-msg' + (m.system ? ' system' : '')}>
                {m.system ? m.text : (<><span className="chat-name">{m.emoji} {m.name}</span>{m.text}</>)}
              </div>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
              placeholder="메시지 입력…"
              aria-label="대기실 채팅 입력"
            />
            <button className="pill-btn small" onClick={sendChat}>전송</button>
          </div>
        </div>
      </div>
    </div>
  );
}
