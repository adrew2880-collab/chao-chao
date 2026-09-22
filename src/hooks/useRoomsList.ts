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
import { collection, onSnapshot, query, where, type FirestoreError } from 'firebase/firestore';
import { getDb, getFirebaseInitError } from '@/lib/firebaseClient';
import type { Room } from '@/lib/types';

export function useRoomsList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 로비 화면(방 목록)을 열 때마다 백그라운드로 유령 방 청소를 한 번 트리거한다.
    // 응답을 기다리지 않는다(fire-and-forget) — 실패해도 방 목록 자체(onSnapshot
    // 구독)는 정상 동작하고, 다음에 누군가 로비에 들어올 때 다시 시도된다. 실제
    // 삭제는 서버(app/api/rooms/cleanup, Admin SDK)가 하고, 그 결과가 이 구독에도
    // onSnapshot을 통해 자동 반영된다(방금 지워진 방은 목록에서 사라진다).
    fetch('/api/rooms/cleanup', { method: 'POST' }).catch((err) => {
      console.error('[useRoomsList] 유령 방 청소 트리거 실패:', err);
    });

    const db = getDb();
    if (!db) {
      // Firebase 클라이언트 초기화 자체가 실패한 경우(환경변수 누락 등) — 여기서
      // Firestore 구독을 아예 시도하지 않고, 원인이 담긴 메시지를 그대로 화면에
      // 보여준다(Lobby.tsx가 이 error를 렌더링한다).
      const msg = getFirebaseInitError() ?? 'Firebase 초기화에 실패했습니다.';
      console.error('[useRoomsList] Firebase가 초기화되지 않아 방 목록을 구독할 수 없습니다:', msg);
      setError(msg);
      setLoading(false);
      return;
    }

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
      (err: FirestoreError) => {
        // FirestoreError는 code(예: 'permission-denied', 'unavailable', 'invalid-argument')와
        // message를 함께 제공한다 — 콘솔을 볼 수 없는 모바일에서도 원인을 유추할 수 있도록
        // 화면에 코드까지 그대로 노출한다.
        console.error('[useRoomsList] 방 목록 구독 실패:', err.code, err.message);
        setError(`방 목록을 불러오지 못했습니다. (${err.code}: ${err.message})`);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { rooms, loading, error };
}
