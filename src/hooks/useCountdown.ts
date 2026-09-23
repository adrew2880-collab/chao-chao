'use client';

import { useEffect, useState } from 'react';

/* =========================================================================
 *  TIMER HOOKS
 *  DECLARE와 DOUBT 두 구간 모두 "deadline(타임스탬프) 저장 + setTimeout으로 정확히
 *  한 번 발화 + 화면 표시용 setInterval" 패턴을 동일하게 사용한다. deadline을
 *  상태에 저장해두면, 리렌더가 몇 번 일어나도 실제 만료 시점은 흔들리지 않는다.
 *
 *  clockOffsetMs: deadline은 서버(gameReducer가 실행되는 Vercel 함수)의 Date.now()로
 *  찍힌 값이다. 이 기기의 시계가 서버보다 빠르거나 느리면 "이 기기 기준 남은 시간"이
 *  실제와 달라진다 — clockOffsetMs를 Date.now()에 더해 "서버 기준 지금"에 가깝게
 *  보정한다(RemoteGameScreen이 room.lastActiveAt 기준으로 계산해 넘겨줌, 기본값 0).
 * ========================================================================= */
export function useCountdown(active: boolean, deadline: number | null, clockOffsetMs = 0): number {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [active, deadline]);
  if (!active || !deadline) return 0;
  return Math.max(0, deadline - (Date.now() + clockOffsetMs));
}
