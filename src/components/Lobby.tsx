'use client';

import { useState, type FormEvent } from 'react';
import { isTestMode } from '@/lib/constants';
import { useRoomsList } from '@/hooks/useRoomsList';
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
  onOpenWaitingRoom: (name: string, roomId: string, myPlayerId: number) => void;
  onEnterGame: (name: string, opts: { playerCount: number; testMode: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  // 방 목록: Firestore의 rooms 컬렉션(status=='waiting')을 실시간 구독한다. 다른
  // 기기에서 만든 방도 이 훅을 통해 즉시 이 목록에 나타난다 — 이전에는 이 state가
  // 로컬 useState라서 같은 브라우저 탭 밖으로는 절대 보이지 않았던 것이 이번에
  // 고친 핵심 버그다.
  const { rooms, error: roomsError } = useRoomsList();
  const [myRoomId, setMyRoomId] = useState<string | null>(null);

  // --- 방 생성/참여 중 네트워크 에러 표시 ---
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // 닉네임 필수 입력 검증 에러 — 방 생성/참여 양쪽 버튼에서 공통으로 쓰는 name 필드
  // 하나를 검사하므로 에러 메시지도 하나의 state로 공유한다.
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  // 방 생성/참여 두 액션 모두 시작 전에 이 함수를 거친다. 닉네임이 비어있으면
  // nicknameError를 세팅하고 null을 반환해서 호출부가 즉시 다음 단계로 넘어가지 않고
  // 멈추도록 한다(트림된 닉네임을 반환하면 통과).
  function requireNickname(): string | null {
    const trimmed = name.trim();
    if (!trimmed) {
      setNicknameError('닉네임을 먼저 입력해 주세요');
      return null;
    }
    setNicknameError(null);
    return trimmed;
  }

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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const hostName = requireNickname();
    if (!hostName) return; // 닉네임이 비어있으면 여기서 멈춘다 — API 호출 자체를 시작하지 않는다.
    setBusy(true);
    setActionError(null);
    try {
      const { room, myPlayerId } = await RoomService.createRoom(hostName, roomName.trim() || '이름 없는 방', password.length > 0);
      setMyRoomId(room.id);
      // 방 생성 직후 바로 게임으로 들어가지 않고 대기실로 이동한다. 다른 사람이 실제로
      // 참여하면(다른 기기 포함) 대기실 화면이 Firestore 구독을 통해 실시간으로 갱신된다.
      onOpenWaitingRoom(hostName, room.id, myPlayerId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '방 생성에 실패했습니다.';
      setActionError(msg);
      // [임시 디버깅용] 모바일 브라우저는 개발자 도구 콘솔을 열어보기 어려우므로,
      // 원인을 바로 확인할 수 있도록 alert()로도 띄운다. 문제 해결 후에는 제거해도 된다.
      alert('방 생성 실패: ' + msg);
      console.error('[Lobby] 방 생성 실패:', err);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(roomId: string) {
    const joinerName = requireNickname();
    if (!joinerName) return; // 닉네임이 비어있으면 참여 요청 자체를 보내지 않는다.
    setBusy(true);
    setActionError(null);
    try {
      const { myPlayerId } = await RoomService.joinRoom(roomId, joinerName);
      onOpenWaitingRoom(joinerName, roomId, myPlayerId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '방 참여에 실패했습니다.';
      setActionError(msg);
      // [임시 디버깅용] 위 handleCreate와 동일한 이유로 alert() 추가.
      alert('방 참여 실패: ' + msg);
      console.error('[Lobby] 방 참여 실패:', err);
    } finally {
      setBusy(false);
    }
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

      {actionError && <p className="mono" style={{ color: 'var(--rust)', maxWidth: 1180, margin: '0 auto .6rem' }}>⚠️ {actionError}</p>}

      <div className="lobby-grid">
        <div className="card form-card">
          <h3 className="panel-title"><span className="tag">CREATE</span>방 생성하기</h3>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="f-name">플레이어 이름(닉네임) <span style={{ color: 'var(--rust)' }}>*</span></label>
              <input
                id="f-name"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nicknameError) setNicknameError(null); }}
                placeholder="예: 다람쥐"
              />
              {nicknameError && <p className="field-warn">⚠️ {nicknameError}</p>}
            </div>
            <div className="field">
              <label htmlFor="f-room">방 이름</label>
              <input id="f-room" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="예: 초보 환영" required />
            </div>
            <div className="field">
              <label htmlFor="f-pw">비밀번호 (비워두면 공개방)</label>
              <input id="f-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="선택사항" />
            </div>
            <button type="submit" className="pill-btn" disabled={busy}>{busy ? '생성 중…' : '방 생성하기'}</button>
          </form>
        </div>

        <div>
          <h3 className="panel-title"><span className="tag">JOIN</span>방 참여하기</h3>
          {/* 참여하기 전용 닉네임 입력칸. 생성 폼의 닉네임 입력칸과 같은 name state를
              공유하므로 어느 쪽에 입력하든 동일한 닉네임으로 유지된다 — 두 개의 입력칸이
              아니라 "하나의 닉네임을 두 화면에서 보여주는" 개념이다. */}
          <div className="field">
            <label htmlFor="f-name-join">플레이어 이름(닉네임) <span style={{ color: 'var(--rust)' }}>*</span></label>
            <input
              id="f-name-join"
              value={name}
              onChange={(e) => { setName(e.target.value); if (nicknameError) setNicknameError(null); }}
              placeholder="예: 다람쥐"
            />
            {nicknameError && <p className="field-warn">⚠️ {nicknameError}</p>}
          </div>
          <div className="room-list">
            {roomsError && <div className="empty-note">{roomsError}</div>}
            {!roomsError && rooms.length === 0 && <div className="empty-note">열려있는 방이 없습니다. 방을 직접 만들어보세요.</div>}
            {rooms.map((r) => {
              const count = r.participants.length;
              return (
                <div key={r.id} className={'room-card' + (r.id === myRoomId ? ' mine' : '')}>
                  <div>
                    <div className="room-name">{r.locked ? '🔒 ' : ''}{r.name}</div>
                    <div className="room-meta">
                      <span>방장 {r.host}</span>
                      <span>·</span>
                      <span className="mono">{count}/4</span>
                    </div>
                  </div>
                  <button className="pill-btn small" disabled={count >= 4 || busy} onClick={() => handleJoin(r.id)}>
                    {count >= 4 ? '가득 참' : '참여하기'}
                  </button>
                </div>
              );
            })}
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
