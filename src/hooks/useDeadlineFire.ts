'use client';

import { useEffect } from 'react';

export function useDeadlineFire(active: boolean, deadline: number | null, onFire: () => void) {
  useEffect(() => {
    if (!active || !deadline) return;
    const remain = deadline - Date.now();
    const t = setTimeout(onFire, Math.max(0, remain));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, deadline]);
}
