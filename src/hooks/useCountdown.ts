'use client';

import { useEffect, useState } from 'react';

/* =========================================================================
 *  TIMER HOOKS
 *  DECLARE(3초)와 DOUBT(10초) 두 구간 모두 "deadline(타임스탬프) 저장 + setTimeout으로
 *  정확히 한 번 발화 + 화면 표시용 setInterval" 패턴을 동일하게 사용한다.
 *  deadline을 상태에 저장해두면, 리렌더가 몇 번 일어나도 실제 만료 시점은 흔들리지 않는다.
 * ========================================================================= */
export function useCountdown(active: boolean, deadline: number | null): number {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [active, deadline]);
  if (!active || !deadline) return 0;
  return Math.max(0, deadline - Date.now());
}
