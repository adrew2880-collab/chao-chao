'use client';

import { useState } from 'react';
import type { DiceFace } from '@/lib/types';

export function DiceModal({ dice, onConfirm }: { dice: DiceFace | null; onConfirm: () => void }) {
  const [peek, setPeek] = useState(false);
  const face = dice === 'X' ? '🐊' : dice;
  return (
    <div className="modal-veil">
      <div className="card dice-modal">
        <h3>🎲 주사위 확인</h3>
        <div className="warn">다른 플레이어는 화면을 보지 마세요!</div>
        <div
          className={'dice-face' + (peek ? ' peek' : '')}
          onMouseDown={() => setPeek(true)}
          onMouseUp={() => setPeek(false)}
          onMouseLeave={() => setPeek(false)}
          onTouchStart={() => setPeek(true)}
          onTouchEnd={() => setPeek(false)}
        >
          {peek ? face : <span className="back">❔</span>}
        </div>
        <p style={{ fontSize: '.78rem', color: 'var(--ink-dim)', marginBottom: '1rem' }}>
          손가락(또는 마우스)으로 누르고 있으면 결과가 보여요.
        </p>
        <button className="pill-btn" onClick={onConfirm}>확인했어요, 선언하러 가기</button>
      </div>
    </div>
  );
}
