'use client';

import { useEffect, useState } from 'react';
import { BRIDGE_LEN, TOTEMS } from '@/lib/constants';
import type { FallInfo, Player } from '@/lib/types';

export function StoneBridge({
  players,
  resultFalls,
  resultId,
}: {
  players: Player[];
  resultFalls: FallInfo[] | null | undefined;
  resultId: number;
}) {
  const cols = Array.from({ length: BRIDGE_LEN }, (_, i) => i + 1);
  // 같은 칸에 여러 말이 있을 때 겹치지 않도록 플레이어 인덱스별 좌우 오프셋
  // (플레이어 수가 2~4명으로 바뀌어도 항상 칸 중앙 기준으로 대칭이 되도록 계산)
  const offsetFor = (idx: number) => (idx - (players.length - 1) / 2) * 10;
  return (
    <div className="bridge-wrap">
      <div className="bridge-grid">
        {cols.map((n) => (
          <div className="stone-col" key={n}>
            <div className="stone">{n}</div>
          </div>
        ))}
      </div>
      <div className="token-layer">
        {players.filter((p) => p.pos != null).map((p) => {
          const leftPct = ((p.pos! - 0.5) / BRIDGE_LEN) * 100;
          const zig = p.pos! % 2 === 1 ? '38%' : '62%';
          return (
            <span key={p.id} className="token" style={{ left: `calc(${leftPct}% + ${offsetFor(p.id)}px)`, top: zig }}>
              {p.emoji}
            </span>
          );
        })}
        {resultFalls && resultFalls.map((info, i) => (
          // 한 판에 여러 명이 동시에 의심해서 여러 말이 동시에 늪에 빠질 수 있으므로 배열로 렌더링
          <FallingToken key={resultId + '-' + i} info={info} players={players} offsetFor={offsetFor} />
        ))}
      </div>
    </div>
  );
}

function FallingToken({
  info,
  players,
  offsetFor,
}: {
  info: FallInfo;
  players: Player[];
  offsetFor: (idx: number) => number;
}) {
  const [fall, setFall] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFall(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const player = players.find((p) => p.id === info.playerIdx) || TOTEMS[info.playerIdx];
  const leftPct = ((info.pos - 0.5) / BRIDGE_LEN) * 100;
  const zig = info.pos % 2 === 1 ? '38%' : '62%';
  return (
    <span
      className={'token' + (fall ? ' falling' : '')}
      style={{
        left: `calc(${leftPct}% + ${offsetFor(info.playerIdx)}px)`,
        top: fall ? '150%' : zig,
        opacity: fall ? 0 : 1,
        transform: fall ? 'translate(-50%,-50%) rotate(220deg)' : 'translate(-50%,-50%)',
      }}
    >
      {player.emoji}
    </span>
  );
}
