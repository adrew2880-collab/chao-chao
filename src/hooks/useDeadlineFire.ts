'use client';

import { useEffect } from 'react';

// clockOffsetMs: useCountdown과 동일한 서버-클라이언트 시계 오차 보정값(ms).
// 이게 없으면 클라이언트 시계가 서버보다 빠를 때 타이머가 실제보다 일찍 발화하거나,
// 느릴 때 실제보다 늦게 발화할 수 있다 — 기본값 0(로컬/테스트 모드에서는 보정 불필요).
export function useDeadlineFire(active: boolean, deadline: number | null, onFire: () => void, clockOffsetMs = 0) {
  useEffect(() => {
    if (!active || !deadline) return;
    const remain = deadline - (Date.now() + clockOffsetMs);
    const t = setTimeout(onFire, Math.max(0, remain));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, deadline]);
}
