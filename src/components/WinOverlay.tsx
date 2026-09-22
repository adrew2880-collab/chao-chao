'use client';

import { useEffect, useState } from 'react';
import type { Player } from '@/lib/types';
import { AiService } from '@/services/aiService';

export function WinOverlay({ players, winners }: { players: Player[]; winners: number[] }) {
  const [aiLine, setAiLine] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setAiLoading(true);
    setAiLine(null);
    const names = winners.map((id) => players[id]?.name).filter(Boolean) as string[];
    const score = winners.length ? players[winners[0]].score : 0;
    // 게임 종료 시 승리자에게 AI가 짧은 축하/도발 멘트를 자동으로 생성해 준다.
    // 네트워크 실패에도 승리 화면 자체는 깨지지 않도록 실패 시 고정 문구로 대체한다.
    AiService.fetchWinnerLine(names, score)
      .then((text) => { if (!cancelled) setAiLine(text); })
      .catch(() => { if (!cancelled) setAiLine('🏆 축하합니다! 멋진 눈치싸움이었어요.'); })
      .finally(() => { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winners.join(',')]);

  return (
    <div className="win-veil">
      <div className="win-card">
        <div className="burst">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} style={{ ['--rot' as string]: Math.random() * 360 + 'deg', left: '50%', top: '50%', animationDelay: i * 0.05 + 's' }}>
              {['🏆', '🎉', '🐊', '✨'][i % 4]}
            </span>
          ))}
        </div>
        <div className="win-totems">
          {winners.map((id) => <div className="totem" key={id}>{players[id].emoji}</div>)}
        </div>
        <h2 className="display">{winners.map((id) => players[id].name).join(' & ')} {winners.length > 1 ? '공동 우승!' : '승리!'}</h2>
        <div className={'win-ai-line' + (aiLoading ? ' loading' : '')}>
          {aiLoading ? '🤖 AI가 축하 멘트를 쓰는 중…' : aiLine}
        </div>
        <p style={{ color: 'var(--swamp-ink)' }} className="mono">최종 {players[winners[0]].score}점 · 잠시 후 로비로 돌아갑니다…</p>
      </div>
    </div>
  );
}
