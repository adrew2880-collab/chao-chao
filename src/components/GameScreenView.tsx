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
}: {
  state: GameState;
  sendAction: ActionSender;
  myPlayerId: number;
  testMode: boolean;
  mode: 'light' | 'dark';
  onToggleMode: () => void;
  onExit: () => void;
}) {
  const {
    players, turn, phase, dice, declared, autoDeclared, declareDeadline, doubtDeadline, doubtChoices,
    tokensPerPlayer, podium, podiumScores, result, resultAcks, winners, taunts, chatLog, resultId,
  } = state;
  const current = players[turn];
  const me = players[myPlayerId]; // "나" — 항복/채팅/확인 등 내 전용 액션이 이 값을 기준으로 한다.
  const tauntTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [chatDraft, setChatDraft] = useState('');

  // --- 3초 선언 타이머 ---
  const declareRemain = useCountdown(phase === 'DECLARE', declareDeadline);
  useDeadlineFire(phase === 'DECLARE', declareDeadline, () => GameService.declareTimeout(sendAction));

  // --- 10초 의심/진행 투표 타이머 ---
  const doubtRemain = useCountdown(phase === 'DOUBT', doubtDeadline);
  useDeadlineFire(phase === 'DOUBT', doubtDeadline, () => GameService.doubtTimeout(sendAction));
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

  // --- 놀릴 말이 없는 플레이어의 턴이면 자동으로 기권 처리하고 다음 턴으로 넘김 ---
  // (이건 유저가 버튼을 누르는 게 아니라 게임 규칙이 스스로 판단하는 자동 처리이므로,
  //  "내 클릭만 나에게 적용" 규칙과는 무관하게 current.id를 그대로 쓴다. 실제 방에서는
  //  접속해 있는 클라이언트 여럿이 동시에 이 판단을 내려 중복으로 액션을 보낼 수 있지만,
  //  서버의 gameReducer가 매번 최신 상태를 기준으로 재계산하므로 중복 호출은 무해하다.)
  useEffect(() => {
    if (phase === 'ROLL' && !hasPlayableToken(current) && !current.eliminated) {
      GameService.surrender(sendAction, current.id);
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

            {phase === 'ROLL' && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1.2rem 0' }}>
                <button className="pill-btn" onClick={() => GameService.rollDice(sendAction)}>🎲 주사위 굴리기</button>
              </div>
            )}

            {phase === 'DECLARE' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.6rem', padding: '1rem 0' }}>
                <div className="countdown-bar" style={{ maxWidth: 220 }}><div style={{ width: (declareRemain / DECLARE_MS * 100) + '%' }} /></div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} className="pill-btn" style={{ fontSize: '1.3rem', width: 56, height: 56, padding: 0 }} onClick={() => GameService.declare(sendAction, n)}>{n}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="area-scorebar">
          <PodiumBar players={players} podium={podium} podiumScores={podiumScores} />
        </div>
      </div>

      {phase === 'DICE_PEEK' && <DiceModal dice={dice} onConfirm={() => GameService.confirmDicePeek(sendAction)} />}

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
