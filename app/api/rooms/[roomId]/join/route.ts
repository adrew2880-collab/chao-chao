// app/api/rooms/[roomId]/join/route.ts
// 방 참여 — 정원 확인과 참가자 추가를 하나의 Firestore 트랜잭션으로 묶어서,
// 여러 사람이 거의 동시에 마지막 한 자리에 참여를 시도해도 둘 다 성공해버리는
// 경쟁 조건(race condition)이 생기지 않도록 한다.
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { TOTEMS } from '@/lib/constants';
import type { Participant, Room } from '@/lib/types';

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : '나';

    const adminDb = getAdminDb();
    const ref = adminDb.collection('rooms').doc(roomId);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const room = snap.data() as Room;
      if (room.status !== 'waiting') throw new Error('ALREADY_STARTED');
      if (room.participants.length >= 4) throw new Error('ROOM_FULL');

      const playerIndex = room.participants.length;
      const participant: Participant = { name, emoji: TOTEMS[playerIndex].emoji };
      const participants = [...room.participants, participant];
      tx.update(ref, { participants });
      return { playerIndex, roomName: room.name };
    });

    return NextResponse.json({ myPlayerId: result.playerIndex, roomName: result.roomName });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/rooms/join] 참여 실패:', message);
    if (message === 'NOT_FOUND') return NextResponse.json({ error: '존재하지 않는 방입니다.' }, { status: 404 });
    if (message === 'ALREADY_STARTED') return NextResponse.json({ error: '이미 시작된 방입니다.' }, { status: 409 });
    if (message === 'ROOM_FULL') return NextResponse.json({ error: '방 인원이 가득 찼습니다.' }, { status: 409 });
    return NextResponse.json({ error: '방 참여에 실패했습니다.' }, { status: 500 });
  }
}
