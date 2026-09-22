'use client';

import { useEffect, useState } from 'react';
import { Lobby } from './Lobby';
import { WaitingRoom } from './WaitingRoom';
import { GameScreen } from './GameScreen';

type Screen = 'lobby' | 'waitingroom' | 'game';
type PendingRoom = { roomName: string; startCount: number };

export function GameApp() {
  // 다크모드는 'light'로 먼저 렌더링한 뒤(서버와 동일한 결과라 하이드레이션 불일치가
  // 없다), 마운트 후에만 실제 시스템 설정을 반영한다 — Next.js SSR 환경에서
  // window.matchMedia는 클라이언트에만 존재하기 때문.
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) setMode('dark');
    } catch {
      /* no-op */
    }
  }, []);

  const [screen, setScreen] = useState<Screen>('lobby');
  const [myName, setMyName] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [testMode, setTestMode] = useState(false);
  const [pendingRoom, setPendingRoom] = useState<PendingRoom | null>(null);
  const [gameKey, setGameKey] = useState(0);

  // 방 생성/참여 → 대기실로 이동 (일반 흐름). 테스트 모드는 이 경로를 타지 않는다.
  function openWaitingRoom(name: string, roomName: string, startCount: number) {
    setMyName(name);
    setTestMode(false);
    setPendingRoom({ roomName, startCount });
    setScreen('waitingroom');
  }
  // 대기실에서 [게임 시작]을 눌렀을 때 — 그 시점에 모여있던 인원 그대로 게임을 시작한다.
  function startFromWaitingRoom(count: number) {
    setPlayerCount(count);
    setScreen('game');
    setGameKey((k) => k + 1);
  }
  // 테스트 모드는 대기실 없이 바로 게임으로 진입한다.
  function enterGame(name: string, opts: { playerCount: number; testMode: boolean }) {
    setMyName(name);
    setPlayerCount(opts.playerCount || 4);
    setTestMode(!!opts.testMode);
    setScreen('game');
    setGameKey((k) => k + 1);
  }
  function exitToLobby() {
    setScreen('lobby');
    setTestMode(false);
    setPendingRoom(null);
    setGameKey((k) => k + 1);
  }
  function toggleMode() {
    setMode((m) => (m === 'dark' ? 'light' : 'dark'));
  }

  return (
    <div id="app-root" data-mode={mode}>
      {screen === 'lobby' && (
        <Lobby mode={mode} onToggleMode={toggleMode} onOpenWaitingRoom={openWaitingRoom} onEnterGame={enterGame} />
      )}
      {screen === 'waitingroom' && pendingRoom && (
        <WaitingRoom
          roomName={pendingRoom.roomName}
          myName={myName}
          startCount={pendingRoom.startCount}
          onStart={startFromWaitingRoom}
          onCancel={() => setScreen('lobby')}
        />
      )}
      {screen === 'game' && (
        <GameScreen key={gameKey} myName={myName} playerCount={playerCount} testMode={testMode} mode={mode} onToggleMode={toggleMode} onExit={exitToLobby} />
      )}
    </div>
  );
}
