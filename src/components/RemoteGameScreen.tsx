'use client';

import { useCallback } from 'react';
import { useRoomDoc } from '@/hooks/useRoomDoc';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useLeaveOnUnload } from '@/hooks/useLeaveOnUnload';
import type { ActionSender } from '@/lib/types';
import { GameScreenView } from './GameScreenView';

/* =========================================================================
 *  RemoteGameScreen — 실제(원격) 방 전용 래퍼
 *  -------------------------------------------------------------------------
 *  게임 상태를 로컬 useReducer가 아니라 useRoomDoc(Firestore onSnapshot 구독)으로
 *  받아온다. sendAction을 호출하면 로컬 state를 직접 바꾸지 않고, 대신 서버의
 *  app/api/games/[roomId]/action 라우트로 액션 객체를 POST한다 — 서버가
 *  gameReducer를 실행해 다음 상태를 계산하고 Firestore에 쓰면, 그 변경이 다시
 *  onSnapshot을 통해 이 화면을 포함한 "방에 있는 모든 기기"로 동시에 돌아온다.
 *  그래서 내 화면에서의 "낙관적 업데이트" 없이도, 서버 왕복(대개 수백ms 이내) 뒤에
 *  전원이 정확히 같은 상태를 보게 된다.
 * ========================================================================= */
export function RemoteGameScreen({
  roomId,
  myPlayerId,
  mode,
  onToggleMode,
  onExit,
}: {
  roomId: string;
  myPlayerId: number;
  mode: 'light' | 'dark';
  onToggleMode: () => void;
  onExit: () => void;
}) {
  const { room, loading, error } = useRoomDoc(roomId);

  // 유령 방 청소 관련: 게임 화면을 열어둔 동안에도 하트비트를 계속 보내고(대기실과
  // 동일한 훅), 탭을 닫거나 나가면 이 좌석을 자동 항복(SURRENDER) 처리한다 —
  // "턴을 가진 유저가 팅기면 게임이 멈추는" 문제를 leave 라우트가 gameReducer의
  // 기존 SURRENDER 로직을 재사용해 막아준다(남은 인원 1명이면 즉시 종료·승리 처리).
  useHeartbeat(roomId);
  useLeaveOnUnload(roomId, myPlayerId);

  const sendAction: ActionSender = useCallback(
    (action) => {
      fetch(`/api/games/${roomId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      }).catch((err) => {
        // 네트워크 실패는 조용히 무시하지 않고 로그만 남긴다 — 어차피 다음 성공한
        // 액션이 오면 Firestore 구독을 통해 상태가 다시 맞춰진다.
        console.error('[RemoteGameScreen] 액션 전송 실패:', err);
      });
    },
    [roomId]
  );

  if (loading) {
    return <div className="game-shell"><p className="mono" style={{ padding: '2rem' }}>게임 상태를 불러오는 중…</p></div>;
  }
  if (error || !room || !room.gameState) {
    return (
      <div className="game-shell">
        <p className="mono" style={{ padding: '2rem' }}>
          {error || '게임 정보를 찾을 수 없습니다.'}
        </p>
        <button className="pill-btn" onClick={onExit}>← 로비로</button>
      </div>
    );
  }

  // 클라이언트-서버 시계 오차 보정: room.lastActiveAt은 서버가 이 gameState를 쓴
  // "바로 그 순간"에 Date.now()로 찍은 값이다(app/api/games/[roomId]/action/route.ts가
  // gameState와 lastActiveAt을 같은 트랜잭션에서 함께 쓴다) — 그래서 "서버 시계가
  // 이 기기 시계보다 얼마나 빠른/느린가"의 근사치로 쓸 수 있다. declareDeadline/
  // doubtDeadline도 같은 서버가 같은 순간에 찍은 값이라, 이 오차만큼 보정해주면
  // 타이머가 실제보다 짧아/길어 보이는 문제를 줄일 수 있다.
  const clockOffsetMs = room.lastActiveAt - Date.now();

  return (
    <GameScreenView
      state={room.gameState}
      sendAction={sendAction}
      myPlayerId={myPlayerId}
      testMode={false}
      mode={mode}
      onToggleMode={onToggleMode}
      onExit={onExit}
      clockOffsetMs={clockOffsetMs}
    />
  );
}
