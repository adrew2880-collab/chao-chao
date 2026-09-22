// src/lib/roomCleanup.ts
// 유령 방(ghost room) 청소 공통 로직. "방치된 방"의 정의는 status와 무관하게
// lastActiveAt이 ROOM_STALE_MS(10분)보다 오래된 경우다 — 대기실에 멈춰 로비에
// 계속 보이는 방뿐 아니라, 인게임 중 전원이 이탈해 방치된 방도 같은 기준으로
// 정리한다(둘 다 Firestore 저장 공간을 낭비하는 건 마찬가지이므로).
import type { Firestore } from 'firebase-admin/firestore';
import { ROOM_STALE_MS } from './constants';
import type { Room } from './types';

export function isRoomStale(room: Pick<Room, 'lastActiveAt'>, now = Date.now()): boolean {
  return now - room.lastActiveAt >= ROOM_STALE_MS;
}

// 서버(Admin SDK)에서 lastActiveAt이 오래된 방을 찾아 전부 삭제한다.
// 한 번 호출에 너무 많은 문서를 지우지 않도록 상한을 둔다 — 로비 진입 시마다
// 호출되는 가벼운 백그라운드 작업이라, 한 번에 몇 개만 지워도 결국 다 정리된다.
export async function deleteStaleRooms(adminDb: Firestore, limit = 20): Promise<number> {
  const cutoff = Date.now() - ROOM_STALE_MS;
  const snap = await adminDb.collection('rooms').where('lastActiveAt', '<', cutoff).limit(limit).get();
  if (snap.empty) return 0;
  const batch = adminDb.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}
