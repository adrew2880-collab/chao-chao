'use client';

// 로비 화면의 "방 참여하기" 목록 — Firestore의 rooms 컬렉션 중 status가 'waiting'인
// 문서들을 실시간(onSnapshot)으로 구독한다. 다른 기기에서 방을 생성/시작하면 이 훅을
// 쓰는 모든 브라우저에 자동으로 반영된다 — "모바일에서 만든 방이 PC에는 안 보인다"는
// 이번에 고치는 버그의 핵심 해결 지점이 바로 이 실시간 구독이다.
//
// where('status','==','waiting')에 orderBy까지 같이 걸면 Firestore가 복합 색인
// (composite index)을 미리 만들어 달라고 요구하므로, 정렬(최신 방이 위로)은 서버에
// 맡기지 않고 클라이언트에서 간단히 처리한다.
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import type { Room } from '@/lib/types';

export function useRoomsList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'rooms'), where('status', '==', 'waiting'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Room);
        list.sort((a, b) => b.createdAt - a.createdAt); // 최신 방이 위로
        setRooms(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useRoomsList] 방 목록 구독 실패:', err);
        setError('방 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { rooms, loading, error };
}
