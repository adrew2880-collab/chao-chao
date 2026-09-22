'use client';

import { TAUNTS } from '@/lib/constants';
import type { Player } from '@/lib/types';

export function PlayerCard({
  player,
  isCurrent,
  isMe,
  onTaunt,
  bubble,
}: {
  player: Player;
  isCurrent: boolean;
  isMe: boolean;
  onTaunt: (playerIdx: number, text: string) => void;
  bubble?: string;
}) {
  return (
    <div className={'player-card' + (isCurrent ? ' current' : '') + (player.eliminated ? ' eliminated' : '')}>
      {isCurrent && <span className="turn-arrow">➡️</span>}
      {bubble && <span className="speech-bubble">{bubble}</span>}
      <div className="totem">{player.emoji}</div>
      <div className="player-info">
        <div className="player-name">{player.name}{isMe ? ' (나)' : ''}{player.eliminated ? ' (기권)' : ''}</div>
        <div className="player-score mono">🏆 {player.score}점</div>
        {/* 매크로 채팅(도발) 버튼: 실제 멀티플레이라면 각자의 클라이언트가 남의 버튼은 아예
            내려받지 않는 것과 같은 효과를 내기 위해, MY_PLAYER_ID 를 가진 "내" 카드 아래에만
            렌더링한다 — 남의 화면에는 이 버튼 뭉치가 보이지 않아야 하므로 isMe 로 게이트한다. */}
        {isMe && !isCurrent && !player.eliminated && (
          <div className="taunt-row">
            {TAUNTS.map((t) => (
              <button key={t} className="taunt-btn" onClick={() => onTaunt(player.id, t)}>{t}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
