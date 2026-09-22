'use client';

import { useCallback } from 'react';
import { useRoomDoc } from '@/hooks/useRoomDoc';
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

  return (
    <GameScreenView
      state={room.gameState}
      sendAction={sendAction}
      myPlayerId={myPlayerId}
      testMode={false}
      mode={mode}
      onToggleMode={onToggleMode}
      onExit={onExit}
    />
  );
}
