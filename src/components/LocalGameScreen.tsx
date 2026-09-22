'use client';

import { useReducer } from 'react';
import { TEST_MODE_MY_PLAYER_ID } from '@/lib/constants';
import { makeInitialGame, makeTestParticipants } from '@/lib/gameLogic';
import { gameReducer } from '@/lib/gameReducer';
import { GameScreenView } from './GameScreenView';

/* =========================================================================
 *  LocalGameScreen — 테스트 모드(핫시트) 전용 래퍼
 *  -------------------------------------------------------------------------
 *  대기실/서버 없이, 로컬 useReducer 하나로 이 브라우저 안에서만 게임이 진행된다.
 *  sendAction은 그냥 dispatch를 그대로 넘긴다 — 네트워크 왕복이 없으니 모든 액션이
 *  동기적으로 즉시 반영된다. "내 좌석"은 언제나 0번(TEST_MODE_MY_PLAYER_ID)이다.
 * ========================================================================= */
export function LocalGameScreen({
  myName,
  playerCount,
  mode,
  onToggleMode,
  onExit,
}: {
  myName: string;
  playerCount: number;
  mode: 'light' | 'dark';
  onToggleMode: () => void;
  onExit: () => void;
}) {
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined as never,
    () => makeInitialGame(makeTestParticipants(myName, playerCount))
  );

  return (
    <GameScreenView
      state={state}
      sendAction={dispatch}
      myPlayerId={TEST_MODE_MY_PLAYER_ID}
      testMode={true}
      mode={mode}
      onToggleMode={onToggleMode}
      onExit={onExit}
    />
  );
}
