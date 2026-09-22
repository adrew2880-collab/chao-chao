'use client';

import { useState, type FormEvent } from 'react';
import { isTestMode } from '@/lib/constants';
import type { Room } from '@/lib/types';
import { RoomService } from '@/services/roomService';
import { AiService } from '@/services/aiService';
import { ThemeToggle } from './ThemeToggle';

export function Lobby({
  mode,
  onToggleMode,
  onOpenWaitingRoom,
  onEnterGame,
}: {
  mode: 'light' | 'dark';
  onToggleMode: () => void;
  onOpenWaitingRoom: (name: string, roomName: string, startCount: number) => void;
  onEnterGame: (name: string, opts: { playerCount: number; testMode: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  // 방 목록: 하드코딩된 가짜 방 없이, 오직 내가 실제로 "방 생성하기"로 만든 방만 여기 쌓인다.
  // 나중에 서버가 생기면 이 state는 RoomService.listRooms() 같은 구독/폴링 결과로 대체된다.
  const [rooms, setRooms] = useState<Room[]>([]);
  const [myRoomId, setMyRoomId] = useState<string | null>(null);

  // --- 테스트 모드 전용 상태 (isTestMode=false면 아래 패널이 아예 렌더링되지 않으므로
  //     이 state들도 실질적으로 쓰이지 않게 된다) ---
  const [testModeOn, setTestModeOn] = useState(false);
  const [testCount, setTestCount] = useState(4);

  // --- AI 홍보 문구 ---
  const [promo, setPromo] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  async function handleGeneratePromo() {
    setPromoLoading(true);
    setPromoError(null);
    try {
      const text = await AiService.fetchPromo();
      setPromo(text);
    } catch (err) {
      setPromoError('문구 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      console.error(err);
    } finally {
      setPromoLoading(false);
    }
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const room = RoomService.createRoom(name.trim() || '나', roomName.trim() || '이름 없는 방', password.length > 0);
    setRooms((r) => [room, ...r]);
    setMyRoomId(room.id);
    // 방 생성 직후 바로 게임으로 들어가지 않고 대기실로 이동한다.
    // 방장 혼자(1명)인 채로 대기실이 열리고, 실제 서버가 붙기 전까지는 다른 사람이
    // 저절로 들어오지 않는다(더미 자동 입장 없음).
    onOpenWaitingRoom(name, room.name, 1);
  }

  function handleJoin(r: Room) {
    if (r.players >= 4) return; // 이미 인원이 찬 방은 참여할 수 없다.
    onOpenWaitingRoom(name, r.name, r.players);
  }

  function handleTestStart() {
    // 방장(나) + 더미 (testCount-1)명 = 총 testCount인, 전원 핫시트로 이 화면에서 직접 조작한다.
    onEnterGame(name, { playerCount: testCount, testMode: true });
  }

  return (
    <div className="lobby-shell">
      <div className="lobby-topbar">
        <div className="brand">
          <h1 className="display">챠오챠오</h1>
          <div className="tagline">몽키 브릿지를 건너는 눈치싸움 — 거짓 선언과 의심의 게임</div>
          {promo && <div className="ai-promo">✨ {promo}</div>}
          {promoError && <div className="ai-promo" style={{ color: 'var(--rust)' }}>{promoError}</div>}
          <button className="pill-btn ghost small" style={{ marginTop: '.5rem', alignSelf: 'flex-start' }} onClick={handleGeneratePromo} disabled={promoLoading}>
            {promoLoading ? 'AI가 문구를 쓰는 중…' : '✨ AI 홍보 문구 생성'}
          </button>
        </div>
        <ThemeToggle mode={mode} onToggle={onToggleMode} />
      </div>

      <div className="lobby-grid">
        <div className="card form-card">
          <h3 className="panel-title"><span className="tag">CREATE</span>방 생성하기</h3>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="f-name">플레이어 이름</label>
              <input id="f-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 다람쥐" />
            </div>
            <div className="field">
              <label htmlFor="f-room">방 이름</label>
              <input id="f-room" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="예: 초보 환영" required />
            </div>
            <div className="field">
              <label htmlFor="f-pw">비밀번호 (비워두면 공개방)</label>
              <input id="f-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="선택사항" />
            </div>
            <button type="submit" className="pill-btn">방 생성하기</button>
          </form>
        </div>

        <div>
          <h3 className="panel-title"><span className="tag">JOIN</span>방 참여하기</h3>
          <div className="room-list">
            {rooms.length === 0 && <div className="empty-note">열려있는 방이 없습니다. 방을 직접 만들어보세요.</div>}
            {rooms.map((r) => (
              <div key={r.id} className={'room-card' + (r.id === myRoomId ? ' mine' : '')}>
                <div>
                  <div className="room-name">{r.locked ? '🔒 ' : ''}{r.name}</div>
                  <div className="room-meta">
                    <span>방장 {r.host}</span>
                    <span>·</span>
                    <span className="mono">{r.players}/4</span>
                  </div>
                </div>
                <button className="pill-btn small" disabled={r.players >= 4} onClick={() => handleJoin(r)}>
                  {r.players >= 4 ? '가득 참' : '참여하기'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isTestMode && (
        <div className="card test-panel">
          <h3 className="panel-title"><span className="tag test-tag">DEV</span>테스트 모드</h3>
          <p className="test-desc">
            방에 나 혼자뿐이라 턴제 흐름을 확인할 수 없을 때 켜세요. 더미 플레이어를 함께 세팅해
            바로 게임을 시작하고, 저 자신이 1P~4P 역할을 번갈아 가며 모든 턴을 핫시트로 직접 조작합니다.
          </p>
          <div className="test-row">
            <button className="pill-btn ghost small" onClick={() => setTestModeOn((v) => !v)}>
              {testModeOn ? '🧪 테스트 모드 ON' : '테스트 모드 켜기'}
            </button>
            {testModeOn && (
              <>
                <div className="stepper">
                  <button className="pill-btn small" disabled={testCount <= 2} onClick={() => setTestCount((c) => Math.max(2, c - 1))}>−</button>
                  <span className="mono stepper-num">{testCount}인</span>
                  <button className="pill-btn small" disabled={testCount >= 4} onClick={() => setTestCount((c) => Math.min(4, c + 1))}>+</button>
                </div>
                <button className="pill-btn" onClick={handleTestStart}>▶ 테스트 게임 시작</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
