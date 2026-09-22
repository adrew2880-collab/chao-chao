// app/api/rooms/cleanup/route.ts
// 유령 방 자동 삭제(청소) — 누군가 로비 화면에서 방 목록을 불러올 때마다
// useRoomsList 훅이 이 라우트를 백그라운드로 한 번 호출한다(응답을 기다리지 않고
// fire-and-forget). lastActiveAt이 10분 넘게 갱신되지 않은 방(대기실에 멈춰있거나,
// 게임 도중 전원이 이탈해 방치된 방 모두 포함)을 찾아 그대로 삭제한다.
//
// 클라이언트는 Firestore에 직접 쓰기(삭제 포함)를 할 수 없으므로(firestore.rules:
// allow write: if false) 반드시 이 서버 라우트(Admin SDK)를 거쳐야 한다.
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { deleteStaleRooms } from '@/lib/roomCleanup';

export async function POST() {
  try {
    const deletedCount = await deleteStaleRooms(getAdminDb());
    return NextResponse.json({ ok: true, deletedCount });
  } catch (err) {
    // 청소 실패는 사용자 경험에 치명적이지 않으므로(다음 로비 진입 때 다시 시도됨)
    // 로그만 남기고 500으로 응답한다 — 클라이언트는 이 실패를 무시해도 된다.
    console.error('[api/rooms/cleanup] 유령 방 청소 실패:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: '방 청소에 실패했습니다.' }, { status: 500 });
  }
}
