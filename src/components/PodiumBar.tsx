'use client';

import type { Player } from '@/lib/types';

// 시상대(하단 바) — 인원수에 따른 원형 칸(5/6/7개)에 도착 순서대로 채워진다.
// 점수가 역순(뒤 칸일수록 고득점)이므로, 금/은/동 메달도 "뒤에서부터" 매긴다.
export function PodiumBar({
  players,
  podium,
  podiumScores,
}: {
  players: Player[];
  podium: number[];
  podiumScores: number[];
}) {
  return (
    <div className="card podium-card">
      <div className="podium-title">
        🏆 시상대({podiumScores.length}칸) — 앞 칸부터 도착 순서대로 채워지고, 늦게 도착할수록(뒷 칸일수록) 고득점!
      </div>
      <div className="podium-row">
        {podiumScores.map((pts, i) => {
          const holderId = podium[i];
          const holder = holderId != null ? players.find((p) => p.id === holderId) : null;
          const fromEnd = podiumScores.length - 1 - i;
          const rankClass = fromEnd === 0 ? ' gold' : fromEnd === 1 ? ' silver' : fromEnd === 2 ? ' bronze' : '';
          return (
            <div className="podium-slot" key={i}>
              <div className={'podium-circle' + rankClass + (holder ? ' filled' : '')}>
                {holder ? holder.emoji : i + 1}
              </div>
              <div className="podium-pts mono">{pts}점</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
