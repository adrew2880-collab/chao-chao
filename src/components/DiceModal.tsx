'use client';

import { useState } from 'react';
import type { DiceFace } from '@/lib/types';

/* DiceModal — 주사위 결과를 몰래 확인하는 모달.
 *
 * 이 컴포넌트 자체는 이제 "내 턴일 때, 내 화면에만" 렌더링된다(GameScreenView의
 * `phase === 'DICE_PEEK' && isMyTurn` 가드 참고) — 그래서 다른 플레이어의 기기에는
 * 애초에 이 모달이 뜨지 않는다.
 *
 * holdToPeek: 테스트 모드(핫시트 — 여러 명이 한 화면을 돌려가며 쓰는 경우)에서만
 * true로 넘어온다. 이때는 물리적으로 같은 화면을 공유하므로 "다른 플레이어는 화면을
 * 보지 마세요!" 경고와 함께, 손가락/마우스를 누르고 있는 동안에만 결과가 보이는
 * 방식으로 안전하게 감춘다. 실제(원격) 방에서는 이 화면을 보는 사람이 나 하나뿐이라
 * 굳이 누르고 있을 필요가 없으므로 holdToPeek=false로 바로 결과를 보여준다.
 */
export function DiceModal({
  dice,
  onConfirm,
  holdToPeek = true,
}: {
  dice: DiceFace | null;
  onConfirm: () => void;
  holdToPeek?: boolean;
}) {
  const [peek, setPeek] = useState(false);
  const face = dice === 'X' ? '🐊' : dice;
  const revealed = holdToPeek ? peek : true;
  return (
    <div className="modal-veil">
      <div className="card dice-modal">
        <h3>🎲 주사위 확인</h3>
        <div className="warn">
          {holdToPeek ? '다른 플레이어는 화면을 보지 마세요!' : '이 결과는 당신에게만 보입니다.'}
        </div>
        <div
          className={'dice-face' + (revealed ? ' peek' : '')}
          onMouseDown={() => holdToPeek && setPeek(true)}
          onMouseUp={() => holdToPeek && setPeek(false)}
          onMouseLeave={() => holdToPeek && setPeek(false)}
          onTouchStart={() => holdToPeek && setPeek(true)}
          onTouchEnd={() => holdToPeek && setPeek(false)}
        >
          {revealed ? face : <span className="back">❔</span>}
        </div>
        {holdToPeek && (
          <p style={{ fontSize: '.78rem', color: 'var(--ink-dim)', marginBottom: '1rem' }}>
            손가락(또는 마우스)으로 누르고 있으면 결과가 보여요.
          </p>
        )}
        <button className="pill-btn" onClick={onConfirm}>확인했어요, 선언하러 가기</button>
      </div>
    </div>
  );
}
