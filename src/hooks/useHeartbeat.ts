'use client';

// 대기실/게임 화면을 열어둔 클라이언트가 주기적으로 "나 아직 여기 있어요"를 서버에
// 알린다. 별다른 액션(채팅, 주사위 굴리기 등) 없이 화면만 보고 있어도 방이
// ROOM_STALE_MS(10분) 유령 방 청소에 걸리지 않도록 lastActiveAt을 계속 갱신하는
// 용도다 — roomCleanup.ts / heartbeat route 참고.
import { useEffect } from 'react';
import { HEARTBEAT_MS } from '@/lib/constants';

export function useHeartbeat(roomId: string | null) {
  useEffect(() => {
    if (!roomId) return;
    const id = setInterval(() => {
      fetch(`/api/rooms/${roomId}/heartbeat`, { method: 'POST' }).catch((err) => {
        // 하트비트 한두 번 실패해도(일시적 네트워크 문제 등) 치명적이지 않다 —
        // 다음 주기에 다시 시도되고, 정말 연결이 끊긴 거라면 어차피 나갈 때
        // useLeaveOnUnload가 처리하거나 결국 유령 방 청소가 정리한다.
        console.error('[useHeartbeat] 하트비트 전송 실패:', err);
      });
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [roomId]);
}
