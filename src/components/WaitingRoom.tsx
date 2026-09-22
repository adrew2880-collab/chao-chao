'use client';

import { useState } from 'react';
import { TOTEMS } from '@/lib/constants';
import type { ChatMessage } from '@/lib/types';
import { RoomService } from '@/services/roomService';

/* =========================================================================
 *  WAITING ROOM (대기실)
 *  방 생성/참여 직후 바로 게임으로 들어가지 않고 여기서 인원이 모이길 기다린다.
 *
 *  일반 방(대기실)은 실제로 들어온 인원(지금은 항상 방장 1명)에서 늘지 않고,
 *  진짜로 다른 사람이 들어올 때까지 정직하게 기다린다. 더미 플레이어를 세워
 *  혼자 조종하는 기능은 로비의 '테스트 모드' 버튼(대기실을 거치지 않고 바로
 *  게임 시작)에서만 동작하도록 완전히 분리되어 있다.
 *
 *  실제 서버 연동 후에는 여기서 RoomService.subscribeToRoom(roomId, …) 같은
 *  구독을 걸어, 다른 사람이 실제로 join하면 참가자 목록/채팅이 갱신되는
 *  자리가 된다.
 * ========================================================================= */
export function WaitingRoom({
  roomName,
  myName,
  startCount,
  onStart,
  onCancel,
}: {
  roomName: string;
  myName: string;
  startCount: number;
  onStart: (count: number) => void;
  onCancel: () => void;
}) {
  const count = startCount; // 실제 서버가 없으므로 지금은 늘어나지 않는다(정직한 대기) — 연동 후 실시간 인원으로 교체
  const [chat, setChat] = useState<(ChatMessage & { system?: boolean })[]>(() => [
    { id: 'sys-open', system: true, name: '', emoji: '', text: `"${roomName}" 대기실이 열렸습니다. 다른 사람이 들어오면 여기 표시됩니다.` },
  ]);
  const [draft, setDraft] = useState('');

  function sendChat() {
    if (!draft.trim()) return;
    const me = { name: myName && myName.trim() ? myName.trim() : '나', emoji: TOTEMS[0].emoji };
    setChat((log) => [...log, RoomService.makeChatMessage(me, draft.trim())]);
    setDraft('');
  }

  const participants = Array.from({ length: count }, (_, i) =>
    i === 0 ? { name: myName && myName.trim() ? myName.trim() : '나', emoji: TOTEMS[0].emoji } : TOTEMS[i]
  );
  const canStart = count >= 2; // 방장 권한: 2명 이상 모였을 때만 시작 가능

  return (
    <div className="lobby-shell">
      <div className="lobby-topbar">
        <div className="brand">
          <h1 className="display" style={{ fontSize: '2.1rem' }}>🚪 {roomName}</h1>
          <div className="tagline">플레이어를 기다리는 중… (최소 2명이 모여야 시작할 수 있어요)</div>
        </div>
        <button className="pill-btn ghost small" onClick={onCancel}>← 로비로</button>
      </div>

      <div className="lobby-grid">
        <div className="card form-card">
          <h3 className="panel-title"><span className="tag">{count}/4</span>참가자</h3>
          <div className="wr-list">
            {participants.map((p, i) => (
              <div className="wr-row" key={i}>
                <div className="totem">{p.emoji}</div>
                <div>{p.name}{i === 0 ? ' (나, 방장)' : ''}</div>
              </div>
            ))}
            {count < 4 && <div className="wr-row wr-empty">⏳ 다른 플레이어를 기다리는 중… (서버 연동 전에는 늘어나지 않습니다)</div>}
          </div>
          <button className="pill-btn" disabled={!canStart} onClick={() => onStart(count)}>
            {canStart ? `▶ 게임 시작 (${count}인)` : '2명 이상 모여야 시작할 수 있어요'}
          </button>
        </div>

        <div className="card wr-chat-card">
          <h3 className="panel-title"><span className="tag">CHAT</span>대기실 채팅</h3>
          <div className="chat-log">
            {chat.map((m) => (
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
