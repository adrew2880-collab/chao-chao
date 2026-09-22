'use client';

import { canAct } from '@/lib/constants';
import type { ActionSender, DoubtChoice, Player } from '@/lib/types';
import { GameService } from '@/services/gameService';

export function DoubtPanel({
  sendAction,
  opponents,
  doubtChoices,
  testMode,
  myPlayerId,
  doubtPct,
  doubtSecs,
  votedCount,
}: {
  sendAction: ActionSender;
  opponents: Player[];
  doubtChoices: Record<number, DoubtChoice>;
  testMode: boolean;
  myPlayerId: number;
  doubtPct: number;
  doubtSecs: number;
  votedCount: number;
}) {
  return (
    <div className="doubt-panel">
      <div className="countdown-bar"><div style={{ width: doubtPct + '%' }} /></div>
      <div className="mono" style={{ fontSize: '.75rem', color: 'var(--ink-dim)' }}>
        의심/진행 투표 중 — {doubtSecs}s · {votedCount}/{opponents.length} 투표 완료
      </div>
      <div className="opponent-row">
        {opponents.map((p) => {
          // 투표 권한 분리: 실제 멀티플레이라면 각 클라이언트는 자기 좌석(myPlayerId)의
          // 버튼만 조작할 수 있다. 테스트 모드일 때만 예외적으로 모든 좌석의 버튼이
          // 로컬에서 조작 가능해진다 — canAct() 가 그 판단을 맡는다(항복 버튼과 달리,
          // 투표/확인 버튼은 테스트 모드에서 예외를 허용한다).
          const acted = !!doubtChoices[p.id];
          const clickable = canAct(p.id, testMode, myPlayerId);
          return (
            <div key={p.id} className="card opponent-choice">
              <div className="name">{p.emoji} {p.name}</div>
              {acted ? (
                // 무엇을 선택했는지는 아직 밝히지 않는다 — 전원이 투표를 마쳐야만
                // resolveRound가 호출되어 한 번에 결과가 공개된다.
                <div className="choice-made">✅ 투표 완료<br /><span style={{ fontSize: '.62rem' }}>(전원 투표 후 공개)</span></div>
              ) : clickable ? (
                <div className="btns">
                  <button className="pill-btn swamp small" onClick={() => GameService.vote(sendAction, p.id, 'doubt')}>👁️ 의심</button>
                  <button className="pill-btn ghost small" onClick={() => GameService.vote(sendAction, p.id, 'pass')}>➡️ 진행</button>
                </div>
              ) : (
                <div className="choice-made">⏳ 상대방 선택 대기 중</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
