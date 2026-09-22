// app/api/rooms/[roomId]/start/route.ts
// 대기실에서 [게임 시작]을 누르면 호출된다. 그 시점까지 모인 실제 participants
// 그대로 makeInitialGame으로 게임 상태를 만들고, 방 문서에 status:'playing' +
// gameState를 기록한다. 이후 모든 클라이언트는 useRoomDoc 구독을 통해 이 변화를
// 감지하고 자동으로 게임 화면으로 전환된다(WaitingRoom 컴포넌트 참고).
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { makeInitialGame } from '@/lib/gameLogic';
import type { Room } from '@/lib/types';

export async function POST(_req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    const adminDb = getAdminDb();
    const ref = adminDb.collection('rooms').doc(roomId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const room = snap.data() as Room;
      if (room.status === 'playing') return; // 다른 클라이언트가 이미 시작시킴 — 조용히 통과
      if (room.participants.length < 2) throw new Error('NOT_ENOUGH_PLAYERS');
      const gameState = makeInitialGame(room.participants);
      tx.update(ref, { status: 'playing', gameState });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/rooms/start] 시작 실패:', message);
    if (message === 'NOT_FOUND') return NextResponse.json({ error: '존재하지 않는 방입니다.' }, { status: 404 });
    if (message === 'NOT_ENOUGH_PLAYERS')
      return NextResponse.json({ error: '최소 2명이 모여야 시작할 수 있습니다.' }, { status: 400 });
    return NextResponse.json({ error: '게임 시작에 실패했습니다.' }, { status: 500 });
  }
}
