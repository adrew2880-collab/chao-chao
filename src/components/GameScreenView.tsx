'use client';

import { useEffect, useRef, useState } from 'react';
import { canAct, DECLARE_MS, DOUBT_MS, TAUNT_MS, isTestMode } from '@/lib/constants';
import { hasPlayableToken } from '@/lib/gameLogic';
import { useCountdown } from '@/hooks/useCountdown';
import { useDeadlineFire } from '@/hooks/useDeadlineFire';
import { RoomService } from '@/services/roomService';
import { GameService } from '@/services/gameService';
import type { ActionSender, GameState } from '@/lib/types';
import { ThemeToggle } from './ThemeToggle';
import { PlayerCard } from './PlayerCard';
import { GoalZone } from './GoalZone';
import { StoneBridge } from './StoneBridge';
import { DoubtPanel } from './DoubtPanel';
import { PodiumBar } from './PodiumBar';
import { ResultPopup } from './ResultPopup';
import { DiceModal } from './DiceModal';
import { WinOverlay } from './WinOverlay';

/* =========================================================================
 *  GameScreenView — 순수 "표시용(presentational)" 게임 화면
 *  -------------------------------------------------------------------------
 *  이 컴포넌트는 게임 상태를 어디서 가져왔는지(로컬 useReducer인지, Firestore
 *  실시간 구독인지) 전혀 모른다 — 그냥 state를 그리고, 사용자가 뭔가를 누르면
 *  sendAction(액션 객체)을 호출할 뿐이다. 실제 상태 관리는 두 개의 얇은 래퍼가
 *  나눠 맡는다:
 *    - LocalGameScreen  (테스트 모드: useReducer로 이 브라우저 안에서만 진행)
 *    - RemoteGameScreen (실제 방: Firestore onSnapshot 구독 + API POST)
 *  두 래퍼가 훅 호출 방식이 근본적으로 다르기 때문에(하나는 로컬 상태, 하나는
 *  구독) 한 컴포넌트 안에서 조건부로 섞을 수 없어 이렇게 분리했다(React의
 *  "훅은 조건부로 호출할 수 없다" 규칙 때문) — GameScreen.tsx의 분기 주석 참고.
 *
 *  myPlayerId: "내 좌석 번호". 테스트 모드에서는 항상 0(TEST_MODE_MY_PLAYER_ID),
 *  실제 방에서는 방 생성/참여 API가 내려준 값이다. 항복/채팅/확인 등 "내 전용"
 *  액션과, canAct()를 통한 버튼 권한 분리가 전부 이 값을 기준으로 한다.
 * ========================================================================= */
export function GameScreenView({
  state,
  sendAction,
  myPlayerId,
  testMode,
  mode,
  onToggleMode,
  onExit,
  clockOffsetMs = 0,
}: {
  state: GameState;
  sendAction: ActionSender;
  myPlayerId: number;
  testMode: boolean;
  mode: 'light' | 'dark';
  onToggleMode: () => void;
  onExit: () => void;
  // 이 기기의 Date.now()에 더하면 "서버 기준 지금"에 더 가까워지는 보정값(ms).
  // 로컬(테스트 모드)에는 서버가 따로 없으므로 항상 0 — RemoteGameScreen이
  // room.lastActiveAt(서버가 마지막 쓰기 때 찍은 시각)과 클라이언트 시계를 비교해
  // 계산해 넘겨준다. 타이머(declareDeadline/doubtDeadline)는 서버가 Date.now()로
  // 찍은 값이라, 클라이언트 시계가 서버보다 빠르거나 느리면 실제보다 타이머가
  // 짧아/길어 보일 수 있는데 이 보정으로 그 오차를 줄인다.
  clockOffsetMs?: number;
}) {
  const {
    players, turn, phase, dice, declared, autoDeclared, declareDeadline, doubtDeadline, doubtChoices,
    tokensPerPlayer, podium, podiumScores, result, resultAcks, winners, taunts, chatLog, resultId,
  } = state;
  const current = players[turn];
  const me = players[myPlayerId]; // "나" — 항복/채팅/확인 등 내 전용 액션이 이 값을 기준으로 한다.

  /* =====================================================================
   *  isMyTurn — "지금 이 화면을 보고 있는 나"와 "현재 턴인 플레이어"가 같은 사람인가.
   *  ---------------------------------------------------------------------
   *  실제 멀티플레이 치명적 버그(권한/시야 노출) 수정: ROLL(주사위 굴리기)과
   *  DECLARE(숫자 선언)는 "내 좌석 버튼만 내가 조작 가능"이 아니라 "지금 턴인
   *  사람만 조작 가능"이라는, canAct()의 "내 좌석 전용"과는 조건이 다른 권한
   *  체크다 — 그래서 canAct(current.id, ...)로 재사용한다: 실제 방에서는
   *  current.id === myPlayerId 일 때만 true, 테스트 모드(핫시트)에서는 한
   *  사람이 모든 턴을 대신 조작해야 하므로 testMode가 true면 무조건 통과시킨다
   *  (canAct의 기존 규칙과 동일한 예외).
   *
   *  이 값이 false인 클라이언트에서는:
   *   - 🎲 주사위 굴리기 버튼이 아예 DOM에 마운트되지 않는다(다른 사람이 대신
   *     굴릴 수 없도록 — 이전에는 phase==='ROLL'이기만 하면 누구나 누를 수 있었다).
   *   - [1,2,3,4] 선언 버튼도 마찬가지로 마운트되지 않는다.
   *   - DICE_PEEK 단계의 주사위 결과 모달 자체가 렌더링되지 않는다 — 이게 이번에
   *     신고된 "내 턴이 아닌데 남의 주사위 결과가 보인다" 버그의 직접적인 원인과
   *     수정 지점이다(예전에는 phase==='DICE_PEEK'이기만 하면 dice 값을 그대로
   *     넘겨 전원에게 렌더링했다).
   * ===================================================================== */
  const isMyTurn = canAct(current.id, testMode, myPlayerId);
  const tauntTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [chatDraft, setChatDraft] = useState('');

  // --- 선언 타이머(DECLARE_MS) --- clockOffsetMs를 넘겨 클라이언트-서버 시계 오차를 보정한다.
  const declareRemain = useCountdown(phase === 'DECLARE', declareDeadline, clockOffsetMs);
  useDeadlineFire(phase === 'DECLARE', declareDeadline, () => GameService.declareTimeout(sendAction), clockOffsetMs);

  // --- 의심/진행 투표 타이머(DOUBT_MS) ---
  const doubtRemain = useCountdown(phase === 'DOUBT', doubtDeadline, clockOffsetMs);
  useDeadlineFire(phase === 'DOUBT', doubtDeadline, () => GameService.doubtTimeout(sendAction), clockOffsetMs);
  const opponents = players.filter((p) => p.id !== turn && !p.eliminated);
  const votedCount = opponents.filter((p) => doubtChoices[p.id]).length;

  // --- 결과 확인(RESULT_ACK) 진행 상황 — 고정 타이머가 아니라 전원의 "확인했어요"
  //     클릭 수를 세어 진행률을 보여준다. 실제로 다음 턴으로 넘기는 것은 reducer의
  //     RESULT_ACK 케이스가 담당한다. ---
  const aliveInResult = players.filter((p) => !p.eliminated);
  const ackedCount = aliveInResult.filter((p) => resultAcks[p.id]).length;

  // --- 승리 후 잠시 뒤 로비로 리셋 (AI가 축하 멘트를 생성할 시간을 넉넉히 준다) ---
  useEffect(() => {
    if (phase !== 'GAMEOVER') return;
    const t = setTimeout(() => onExit(), 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // --- 남은 말이 없는 플레이어의 턴이면 자동으로 턴만 넘김(SKIP_EMPTY_TURN) ---
  // (이건 유저가 버튼을 누르는 게 아니라 게임 규칙이 스스로 판단하는 자동 처리이므로,
  //  "내 클릭만 나에게 적용" 규칙과는 무관하게 진행한다. 실제 방에서는 접속해 있는
  //  클라이언트 여럿이 동시에 이 판단을 내려 중복으로 액션을 보낼 수 있지만, 서버의
  //  gameReducer가 매번 최신 상태를 기준으로 재계산하므로 중복 호출은 무해하다.
  //  [버그 수정] 예전에는 GameService.surrender(current.id)를 호출해서 이 플레이어를
  //  eliminated 처리했는데, 그러면 이후 다른 사람의 선언에 대한 의심/승낙 투표권까지
  //  함께 사라졌다. SKIP_EMPTY_TURN은 턴만 넘기고 eliminated는 건드리지 않는다 —
  //  요구사항: "남은 말이 0개라도 다른 사람의 턴에는 투표에 참여할 수 있어야 한다.")
  useEffect(() => {
    if (phase === 'ROLL' && !current.eliminated && !hasPlayableToken(current)) {
      GameService.skipEmptyTurn(sendAction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turn]);

  // --- 도발 말풍선 자동 소멸 (2.2초) ---
  useEffect(() => {
    Object.keys(taunts).forEach((pid) => {
      if (tauntTimers.current[pid]) return;
      tauntTimers.current[pid] = setTimeout(() => {
        GameService.clearTaunt(sendAction, Number(pid));
        delete tauntTimers.current[pid];
      }, TAUNT_MS);
    });
  }, [taunts, sendAction]);

  function handleTaunt(playerIdx: number, text: string) {
    GameService.taunt(sendAction, playerIdx, text);
  }
  function handleSurrender() {
    /* 권한 분리("매우 중요"): 예전에는 current.id(현재 턴을 쥔 사람)를 넘겨서, 내 턴이
     * 아닐 때 이 버튼을 눌러도 그 순간 턴인 다른 플레이어가 대신 탈락하는 버그가 있었다.
     * 항복은 테스트 모드 여부와도 무관하게 언제나 myPlayerId(나)에게만 적용되도록
     * 못박는다 — "내 계정은 오직 나만 포기시킬 수 있다." (canAct()의 testMode 예외조차
     * 두지 않는다: 테스트 모드라고 해서 다른 사람을 대신 항복시키게 하면 이 버그가
     * 되살아난다.) */
    GameService.surrender(sendAction, myPlayerId);
  }
  function sendChat() {
    // 인게임 전체 채팅은 항상 "나"(myPlayerId) 명의로 전송된다.
    if (!chatDraft.trim()) return;
    GameService.sendChat(sendAction, RoomService.makeChatMessage(me, chatDraft.trim()));
    setChatDraft('');
  }

  const declareSecs = Math.ceil(declareRemain / 1000);
  const doubtSecs = Math.ceil(doubtRemain / 1000);
  const doubtPct = doubtDeadline ? Math.max(0, Math.min(100, (doubtRemain / DOUBT_MS) * 100)) : 0;

  return (
    <div className="game-shell">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1180, margin: '0 auto .6rem' }}>
        {isTestMode && testMode ? (
          <span className="mono" style={{ fontSize: '.75rem', color: 'var(--swamp)', border: '1px dashed var(--swamp)', borderRadius: 999, padding: '.3em .8em' }}>
            🧪 테스트 모드 · {players.length}인 전원 핫시트 조작 중
          </span>
        ) : <span />}
        <ThemeToggle mode={mode} onToggle={onToggleMode} />
      </div>
      <div className="game-grid">

        <div className="area-surrender">
          <div className="card surrender-card">
            <button className="pill-btn rust small" onClick={handleSurrender} disabled={phase === 'GAMEOVER' || me.eliminated}>🏳️ 항복</button>
            <p>{me.eliminated ? '이미 기권했습니다' : `${me.emoji} ${me.name}(나)만 게임에서 기권합니다`}</p>
          </div>
        </div>

        <div className="area-declare">
          <div className="declare-slot">
            {(phase === 'DOUBT' || phase === 'RESULT') && declared != null ? (
              <div className="declare-banner">
                <div className="who">🔴 {current.name} 님의 선언{autoDeclared ? ' (시간초과 자동선언)' : ''}</div>
                <span className="num display">{declared}</span>
              </div>
            ) : phase === 'DICE_PEEK' ? (
              <div className="turn-hint">🎲 {current.name}님이 주사위 결과를 확인하는 중…</div>
            ) : phase === 'ROLL' ? (
              <div className="turn-hint">➡️ {current.name}님의 차례 — 주사위를 굴려주세요</div>
            ) : phase === 'DECLARE' ? (
              <div className="turn-hint">🤫 {current.name}님이 숫자를 선언 중… ({declareSecs}s)</div>
            ) : null}
          </div>
        </div>

        <div className="area-profiles">
          <div className="profile-list">
            {players.map((p) => (
              <PlayerCard key={p.id} player={p} isCurrent={p.id === turn && phase !== 'GAMEOVER'} isMe={p.id === myPlayerId} onTaunt={handleTaunt} bubble={taunts[p.id]} />
            ))}
          </div>
          <div className="chat-panel">
            <div className="chat-panel-title mono">💬 전체 채팅</div>
            <div className="chat-log">
              {chatLog.length === 0 && <div className="chat-empty">아직 메시지가 없습니다.</div>}
              {chatLog.map((m) => (
                <div key={m.id} className="chat-msg"><span className="chat-name">{m.emoji} {m.name}</span>{m.text}</div>
              ))}
            </div>
            <div className="chat-input-row">
              <input
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                placeholder="메시지 입력…"
                aria-label="채팅 메시지 입력"
              />
              <button className="pill-btn small" onClick={sendChat}>전송</button>
            </div>
          </div>
        </div>

        <div className="area-goal">
          <GoalZone players={players} tokensPerPlayer={tokensPerPlayer} />
        </div>

        <div className="area-board">
          <div className="card board-card">
            <div className="board-caption">징검다리</div>

            <StoneBridge players={players} resultFalls={result?.fallInfos} resultId={resultId} />
            <div className="swamp" />

            {phase === 'DOUBT' && (
              <DoubtPanel
                sendAction={sendAction}
                opponents={opponents}
                doubtChoices={doubtChoices}
                testMode={testMode}
                myPlayerId={myPlayerId}
                doubtPct={doubtPct}
                doubtSecs={doubtSecs}
                votedCount={votedCount}
              />
            )}

            {/* 액션 버튼 권한 통제: ROLL 버튼은 phase==='ROLL'이기만 하면 예전엔 누구나
                누를 수 있었다 — isMyTurn을 추가로 검사해, 현재 턴이 아닌 클라이언트에는
                버튼 자체를 마운트하지 않고 대기 안내 문구만 보여준다.
                hasPlayableToken(current) 가드: 남은 말이 없는 플레이어는 애초에 굴릴 수
                없어야 한다 — 위 useEffect(SKIP_EMPTY_TURN)가 즉시 턴을 넘기지만, 실제
                방에서는 서버 왕복 시간만큼 짧은 틈이 있을 수 있어 렌더링에서도 한 번 더
                막는다(요구사항: "남은 말이 0개인 플레이어는 주사위를 굴릴 수 없어야 한다"). */}
            {phase === 'ROLL' && (
              isMyTurn && hasPlayableToken(current) ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '1.2rem 0' }}>
                  <button className="pill-btn" onClick={() => GameService.rollDice(sendAction)}>🎲 주사위 굴리기</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '1.2rem 0' }}>
                  <p className="mono" style={{ color: 'var(--ink-dim)', fontSize: '.85rem' }}>
                    {isMyTurn && !hasPlayableToken(current)
                      ? '⏳ 남은 말이 없어 이번 턴은 자동으로 넘어갑니다…'
                      : `⏳ ${current.emoji} ${current.name}님을 기다리는 중…`}
                  </p>
                </div>
              )
            )}

            {/* [1,2,3,4] 선언 버튼도 동일한 이유로 isMyTurn 가드를 추가한다 — 타이머 바는
                살아있는 모두에게 공개된 정보라 그대로 보여주되, 선택 버튼만 가린다. */}
            {phase === 'DECLARE' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.6rem', padding: '1rem 0' }}>
                <div className="countdown-bar" style={{ maxWidth: 220 }}><div style={{ width: (declareRemain / DECLARE_MS * 100) + '%' }} /></div>
                {isMyTurn ? (
                  <div style={{ display: 'flex', gap: '.6rem' }}>
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} className="pill-btn" style={{ fontSize: '1.3rem', width: 56, height: 56, padding: 0 }} onClick={() => GameService.declare(sendAction, n)}>{n}</button>
                    ))}
                  </div>
                ) : (
                  <p className="mono" style={{ color: 'var(--ink-dim)', fontSize: '.85rem' }}>🤫 {current.name}님이 숫자를 고르는 중…</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="area-scorebar">
          <PodiumBar players={players} podium={podium} podiumScores={podiumScores} />
        </div>
      </div>

      {/* 주사위 결과 비공개(치명적 버그 수정): 예전에는 phase==='DICE_PEEK'이기만 하면
          dice 값을 그대로 넘겨서 방에 있는 모든 클라이언트가 이 모달을 렌더링했다 —
          즉 내 턴이 아닌 사람도 남이 굴린 주사위 결과를 볼 수 있었다. isMyTurn을 추가로
          검사해서, 현재 턴이 아닌 클라이언트에는 이 모달 자체를 마운트하지 않는다
          (dice 값도 넘기지 않으므로 DOM에도 값이 존재하지 않는다).
          holdToPeek={testMode}: 테스트 모드(핫시트)에서만 "누르고 있어야 보이는" 물리적
          은폐 방식을 쓰고, 실제 방에서는 이 화면을 보는 사람이 나뿐이므로 바로 보여준다. */}
      {phase === 'DICE_PEEK' && isMyTurn && (
        <DiceModal dice={dice} onConfirm={() => GameService.confirmDicePeek(sendAction)} holdToPeek={testMode} />
      )}

      {phase === 'RESULT' && result && (
        <ResultPopup
          sendAction={sendAction}
          result={result}
          opponents={opponents}
          doubtChoices={doubtChoices}
          aliveInResult={aliveInResult}
          resultAcks={resultAcks}
          ackedCount={ackedCount}
          testMode={testMode}
          myPlayerId={myPlayerId}
        />
      )}

      {phase === 'GAMEOVER' && winners.length > 0 && <WinOverlay players={players} winners={winners} />}
    </div>
  );
}
