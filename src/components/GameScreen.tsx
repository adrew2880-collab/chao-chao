'use client';

import { LocalGameScreen } from './LocalGameScreen';
import { RemoteGameScreen } from './RemoteGameScreen';

/* =========================================================================
 *  GameScreen — LocalGameScreen / RemoteGameScreen 분기용 얇은 래퍼
 *  -------------------------------------------------------------------------
 *  테스트 모드(로컬 useReducer)와 실제 방(Firestore 구독)은 상태를 가져오는
 *  방식 자체가 달라서 서로 다른 훅 집합을 쓴다. 한 컴포넌트 안에서
 *  "testMode ? 이 훅 : 저 훅"처럼 조건부로 훅을 호출하면 React의 "훅은 항상
 *  같은 순서로 호출돼야 한다" 규칙을 깨게 되므로, 아예 컴포넌트 자체를
 *  분기해서 각자 필요한 훅만 호출하도록 나눴다. 실제 화면을 그리는 로직은
 *  두 경로 모두 GameScreenView 하나를 공유한다.
 * ========================================================================= */
export function GameScreen({
  myName,
  playerCount,
  testMode,
  roomId,
  myPlayerId,
  mode,
  onToggleMode,
  onExit,
}: {
  myName: string;
  playerCount: number;
  testMode: boolean;
  roomId: string | null;
  myPlayerId: number;
  mode: 'light' | 'dark';
  onToggleMode: () => void;
  onExit: () => void;
}) {
  if (testMode || !roomId) {
    return <LocalGameScreen myName={myName} playerCount={playerCount} mode={mode} onToggleMode={onToggleMode} onExit={onExit} />;
  }
  return <RemoteGameScreen roomId={roomId} myPlayerId={myPlayerId} mode={mode} onToggleMode={onToggleMode} onExit={onExit} />;
}
