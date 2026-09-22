// app/api/games/[roomId]/action/route.ts
// 인게임 액션(주사위 굴리기, 선언, 의심/진행 투표, 결과 확인, 항복, 도발, 채팅 …) 전부가
// 이 라우트 하나를 거친다. 클라이언트는 "무슨 일이 일어났는지"(GameAction 객체)만
// 보내고, 실제 다음 상태 계산은 항상 서버가 기존과 완전히 동일한 gameReducer로
// 수행한다 — 클라이언트별로 다른 결과를 계산해 각자 다른 상태를 갖게 되는 걸 막는다.
//
// 두 기기가 거의 동시에 액션을 보내는 경우(예: 상대 두 명이 같은 순간 투표)에도
// Firestore 트랜잭션이 "읽기 → gameReducer 계산 → 쓰기"를 하나의 원자적 연산으로
// 묶어주므로, 먼저 읽은 뒤 낡은 상태를 기준으로 계산해 나중 쓰기가 앞선 쓰기를
// 덮어써 버리는 lost-update 문제가 생기지 않는다.
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { gameReducer } from '@/lib/gameReducer';
import type { GameAction, Room } from '@/lib/types';

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    const action = (await req.json()) as GameAction;
    const adminDb = getAdminDb();
    const ref = adminDb.collection('rooms').doc(roomId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const room = snap.data() as Room;
      if (!room.gameState) throw new Error('NOT_STARTED');
      const nextState = gameReducer(room.gameState, action);
      tx.update(ref, { gameState: nextState });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/games/action] 액션 처리 실패:', message);
    if (message === 'NOT_FOUND') return NextResponse.json({ error: '존재하지 않는 방입니다.' }, { status: 404 });
    if (message === 'NOT_STARTED')
      return NextResponse.json({ error: '아직 시작되지 않은 게임입니다.' }, { status: 400 });
    return NextResponse.json({ error: '액션 처리에 실패했습니다.' }, { status: 500 });
  }
}
