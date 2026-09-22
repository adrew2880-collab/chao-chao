'use client';

// 대기실/게임 화면에서 방 문서 하나(rooms/{roomId})를 실시간 구독한다.
// 참가자 목록, 대기실 채팅, 그리고 게임이 시작된 뒤에는 인게임 상태(주사위·선언·투표·
// 말 위치 등) 전체가 이 문서 하나(gameState 필드)에 들어있으므로, onSnapshot 콜백 한
// 번으로 방/게임 상태 전체가 모든 기기에서 동시에 갱신된다 — WaitingRoom과
// RemoteGameScreen이 이 훅 하나를 공유해서 쓴다.
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import type { Room } from '@/lib/types';

export function useRoomDoc(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        setRoom(snap.exists() ? (snap.data() as Room) : null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useRoomDoc] 방 상태 구독 실패:', err);
        setError('방 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [roomId]);

  return { room, loading, error };
}
