// app/api/rooms/[roomId]/heartbeat/route.ts
// 대기실/게임 화면을 열어둔 클라이언트가 useHeartbeat 훅을 통해 주기적으로(기본
// 60초) 호출한다. 방 문서의 lastActiveAt만 "지금"으로 갱신한다 — 실제로 사람이
// 화면을 보고 있는데도 채팅/주사위 같은 "액션"이 한동안 없다는 이유만으로
// ROOM_STALE_MS(10분) 청소 대상이 되어버리는 걸 막는 용도다.
//
// 트랜잭션이 필요 없다(단순 필드 갱신, 다른 값을 읽어서 계산하지 않음). 방이 이미
// 삭제된 뒤에 도착한 하트비트(예: 방장이 방금 방을 폭파한 직후)는 에러가 아니라
// 조용히 무시한다 — 클라이언트가 굳이 매번 실패를 신경 쓸 필요 없게 하기 위해서다.
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function POST(_req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    const adminDb = getAdminDb();
    const ref = adminDb.collection('rooms').doc(roomId);
    const snap = await ref.get();
    if (!snap.exists) {
      // 이미 삭제된 방 — 정상적인 상황(방장이 나가서 방이 폭파됐거나, 유령 방
      // 청소에 걸렸거나)이므로 에러로 취급하지 않는다.
      return NextResponse.json({ ok: true, deleted: true });
    }
    await ref.update({ lastActiveAt: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/rooms/heartbeat] 하트비트 갱신 실패:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: '하트비트 갱신에 실패했습니다.' }, { status: 500 });
  }
}
