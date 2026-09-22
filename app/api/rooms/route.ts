// app/api/rooms/route.ts
// 방 생성 — Admin SDK로 rooms 컬렉션에 새 문서를 만든다.
// 방 "목록 읽기"는 클라이언트가 Firestore를 직접 실시간 구독하지만(useRoomsList),
// "쓰기"(생성)는 언제나 이 서버 라우트를 거친다 — firebaseAdmin.ts 주석 참고.
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { TOTEMS } from '@/lib/constants';
import type { Room } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const hostName = typeof body.hostName === 'string' && body.hostName.trim() ? body.hostName.trim() : '나';
    const roomName = typeof body.roomName === 'string' && body.roomName.trim() ? body.roomName.trim() : '이름 없는 방';
    const locked = !!body.locked;

    const db = getAdminDb();
    const ref = db.collection('rooms').doc();
    const room: Room = {
      id: ref.id,
      name: roomName,
      host: hostName,
      locked,
      status: 'waiting',
      // 방을 만든 사람이 항상 0번 좌석(TOTEMS[0])을 차지한다.
      participants: [{ name: hostName, emoji: TOTEMS[0].emoji }],
      lobbyChat: [
        {
          id: 'sys-open',
          system: true,
          name: '',
          emoji: '',
          text: `"${roomName}" 대기실이 열렸습니다. 다른 사람이 들어오면 여기 표시됩니다.`,
        },
      ],
      gameState: null,
      createdAt: Date.now(),
      lastActiveAt: Date.now(), // 유령 방 청소(roomCleanup.ts)가 기준으로 쓰는 활동 시각
    };
    await ref.set(room);

    // 방을 만든 사람은 언제나 0번 좌석이므로 myPlayerId를 0으로 내려준다.
    return NextResponse.json({ room, myPlayerId: 0 });
  } catch (err) {
    console.error('[api/rooms] 방 생성 실패:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: '방 생성에 실패했습니다.' }, { status: 500 });
  }
}
