'use client';

import { useEffect, useState } from 'react';
import { DICE_SPIN_MS } from '@/lib/constants';
import type { DiceFace } from '@/lib/types';

const SPIN_CYCLE_FACES = ['1', '2', '3', '4', '🐊'];

/* DiceModal — 주사위 결과를 몰래 확인하는 모달.
 *
 * 이 컴포넌트 자체는 이제 "내 턴일 때, 내 화면에만" 렌더링된다(GameScreenView의
 * `phase === 'DICE_PEEK' && isMyTurn` 가드 참고) — 그래서 다른 플레이어의 기기에는
 * 애초에 이 모달이 뜨지 않는다.
 *
 * [테스트 모드 vs 실제 멀티플레이 UI 동기화 버그 수정]
 * 예전에는 `revealed = holdToPeek ? peek : true`였다 — 실제(원격) 방에서는
 * holdToPeek=false라서 마운트되자마자 revealed가 true로 "시작"했고, CSS의
 * `.dice-face.peek{ transform:rotateY(360deg) }` 트랜지션은 값이 실제로 바뀔 때만
 * 재생되므로(처음부터 true면 바뀐 적이 없어 애니메이션이 재생되지 않는다) 숫자가
 * 아무 연출 없이 그냥 나타나 보였다. 테스트 모드에서는 press-and-hold로 peek가
 * false→true로 "바뀌기 때문에" 같은 트랜지션이 우연히 재생됐던 것뿐이다.
 *
 * 이제는 모드와 무관하게 항상 mount 직후 spinning=true로 시작해서 DICE_SPIN_MS 동안
 * 회전 연출(숫자가 빠르게 바뀌며 도는 애니메이션)을 재생하고, 그게 끝난 뒤에야
 * revealed로 전환한다 — 이 전환이 실제로 "false→true로 바뀌는 시점"이라 두 모드
 * 모두에서 동일하게 rotateY 플립이 재생된다. 그리고 "확인했어요" 버튼은 spinning 중엔
 * 비활성화되므로, DECLARE 타이머(declareDeadline은 CONFIRM_DICE가 실제로 서버에
 * 반영된 시점에 설정된다)도 자연히 이 연출이 끝난 뒤부터 시작된다.
 *
 * holdToPeek: 테스트 모드(핫시트 — 여러 명이 한 화면을 돌려가며 쓰는 경우)에서만
 * true로 넘어온다. spin이 끝난 뒤, 이때는 물리적으로 같은 화면을 공유하므로 "다른
 * 플레이어는 화면을 보지 마세요!" 경고와 함께 손가락/마우스를 누르고 있는 동안에만
 * 결과가 보이는 방식으로 안전하게 감춘다. 실제(원격) 방에서는 이 화면을 보는 사람이
 * 나 하나뿐이라 굳이 누르고 있을 필요가 없으므로 holdToPeek=false로 spin 직후 바로
 * 결과를 보여준다.
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
  const [spinning, setSpinning] = useState(true);
  const [spinFace, setSpinFace] = useState(SPIN_CYCLE_FACES[0]);
  const [peek, setPeek] = useState(false);

  // 회전 연출: DICE_SPIN_MS 동안 숫자를 빠르게 순환시켜 "굴러가는" 느낌을 준 뒤 멈춘다.
  useEffect(() => {
    setSpinning(true);
    const cycleId = setInterval(() => {
      setSpinFace(SPIN_CYCLE_FACES[Math.floor(Math.random() * SPIN_CYCLE_FACES.length)]);
    }, 90);
    const stopId = setTimeout(() => setSpinning(false), DICE_SPIN_MS);
    return () => {
      clearInterval(cycleId);
      clearTimeout(stopId);
    };
  }, []);

  const face = dice === 'X' ? '🐊' : dice;
  const revealed = !spinning && (holdToPeek ? peek : true);

  return (
    <div className="modal-veil">
      <div className="card dice-modal">
        <h3>🎲 주사위 확인</h3>
        <div className="warn">
          {spinning ? '주사위를 굴리는 중…' : holdToPeek ? '다른 플레이어는 화면을 보지 마세요!' : '이 결과는 당신에게만 보입니다.'}
        </div>
        <div
          className={'dice-face' + (revealed ? ' peek' : '') + (spinning ? ' spinning' : '')}
          onMouseDown={() => !spinning && holdToPeek && setPeek(true)}
          onMouseUp={() => !spinning && holdToPeek && setPeek(false)}
          onMouseLeave={() => !spinning && holdToPeek && setPeek(false)}
          onTouchStart={() => !spinning && holdToPeek && setPeek(true)}
          onTouchEnd={() => !spinning && holdToPeek && setPeek(false)}
        >
          {spinning ? <span className="spin-num">{spinFace}</span> : revealed ? face : <span className="back">❔</span>}
        </div>
        {!spinning && holdToPeek && (
          <p style={{ fontSize: '.78rem', color: 'var(--ink-dim)', marginBottom: '1rem' }}>
            손가락(또는 마우스)으로 누르고 있으면 결과가 보여요.
          </p>
        )}
        {/* spinning 중에는 아직 결과를 인지하지 못한 상태이므로 확인 버튼을 비활성화한다
            — 이 버튼을 눌러야만(CONFIRM_DICE) DECLARE 타이머가 시작되므로, 여기서 막는
            것만으로 "애니메이션이 끝난 뒤에만 타이머가 시작된다"는 요구사항이 자연스럽게
            충족된다. */}
        <button className="pill-btn" onClick={onConfirm} disabled={spinning}>
          {spinning ? '굴리는 중…' : '확인했어요, 선언하러 가기'}
        </button>
      </div>
    </div>
  );
}
