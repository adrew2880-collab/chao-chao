'use client';

import type { Player } from '@/lib/types';

// 플레이어별 말 상태(대기/사망/도착)를 보여준다.
export function GoalZone({ players, tokensPerPlayer }: { players: Player[]; tokensPerPlayer: number }) {
  return (
    <div className="card goal-card">
      <div className="goal-title">🐎 말 상태</div>
      {players.map((p) => (
        <div className="goal-row" key={p.id}>
          <div className="totem">{p.emoji}</div>
          <div className="goal-stats">
            <div className="goal-name">{p.name}</div>
            <div className="goal-meter">
              <span className="stat stat-waiting">♟️ 대기 {p.waiting}/{tokensPerPlayer}</span>
              <span className="stat stat-dead">💀 사망 {p.dead}/{tokensPerPlayer}</span>
              <span className="stat stat-arrived">🏁 도착 {p.home}/{tokensPerPlayer}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
