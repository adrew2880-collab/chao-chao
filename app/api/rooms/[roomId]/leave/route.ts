// app/api/rooms/[roomId]/leave/route.ts
// 유저 이탈(연결 해제) 처리 — 브라우저 탭을 닫거나 다른 사이트로 이동할 때
// useLeaveOnUnload 훅이 navigator.sendBeacon()으로 호출하고(비동기 fetch는
// 언로드 중간에 취소될 수 있어 신뢰할 수 없다 — sendBeacon은 브라우저가 페이지를
// 실제로 닫은 뒤에도 전송을 보장한다), "← 로비로" 버튼처럼 명시적으로 방을 나갈
// 때는 RoomService.leaveRoom()이 평범한 fetch로 동일한 라우트를 호출한다.
//
// Firestore에는 Realtime Database의 onDisconnect() 같은 "연결 끊김 자동 감지"
// 기능이 없다(RTDB 전용 기능) — 그래서 이 라우트 + 하트비트/유령 방 청소가 그
// 역할을 대신한다: sendBeacon이 실제로 도착하면 즉시 정리되고, 네트워크가
// 끊기는 등 beacon마저 도착하지 못한 경우엔 하트비트가 끊기면서 결국
// ROOM_STALE_MS(10분) 뒤 청소 라우트가 정리한다.
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { gameReducer } from '@/lib/gameReducer';
import type { Room } from '@/lib/types';

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    // sendBeacon으로 온 요청은 Content-Type이 브라우저/버전마다 조금씩 달라질 수
    // 있어(Blob에 명시한 type이 유지되지 않는 경우가 있다) req.json()이 실패할
    // 수 있다 — 텍스트로 받아서 직접 파싱하는 편이 더 안전하다.
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};
    const playerId = Number(body.playerId);
    if (!Number.isInteger(playerId) || playerId < 0) {
      return NextResponse.json({ error: 'playerId가 올바르지 않습니다.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const ref = adminDb.collection('rooms').doc(roomId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return; // 이미 삭제된 방 — 할 일 없음(정상 상황)
      const room = snap.data() as Room;

      if (room.status === 'playing' && room.gameState) {
        // 인게임 이탈: 이미 게임이 끝난 상태(GAMEOVER)라면 아무것도 하지 않는다 —
        // 여기서 또 SURRENDER를 적용하면 이미 확정된 승자가 뒤바뀔 수 있다(예:
        // 정상적으로 이겨서 GAMEOVER가 된 직후 탭을 닫는 경우).
        if (room.gameState.phase === 'GAMEOVER') return;
        // 기존 항복(SURRENDER) 로직을 그대로 재사용한다 — "남은 인원이 1명이 되면
        // 즉시 게임 종료 + 승리 처리"가 이미 gameReducer 안에 구현되어 있다.
        const nextState = gameReducer(room.gameState, { type: 'SURRENDER', playerIdx: playerId });
        tx.update(ref, { gameState: nextState, lastActiveAt: Date.now() });
        return;
      }

      // 로비(대기실) 단계 이탈
      if (playerId === 0) {
        // 방장이 나가면 방 자체를 폭파한다 — 방장 없는 대기실은 의미가 없다.
        tx.delete(ref);
        return;
      }
      if (playerId >= room.participants.length || room.participants[playerId].left) {
        return; // 이미 나갔거나 존재하지 않는 좌석 — 할 일 없음
      }
      // 배열에서 통째로 제거(splice)하지 않고 "나감" 표시만 남긴다 — 그래야 이
      // 사람보다 뒤에 참여한 다른 사람들의 좌석 번호(배열 인덱스)가 밀리지 않는다.
      // 새로 참여하는 사람은 join 라우트가 이 빈 자리를 우선 재사용한다.
      const participants = room.participants.map((p, i) => (i === playerId ? { ...p, left: true } : p));
      tx.update(ref, { participants, lastActiveAt: Date.now() });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/rooms/leave] 이탈 처리 실패:', err instanceof Error ? err.message : err);
    // sendBeacon 호출부는 응답을 읽지 않으므로 상태 코드가 중요하진 않지만,
    // 명시적으로 나가기 버튼을 누른 경우(fetch)를 위해 에러 응답을 내려준다.
    return NextResponse.json({ error: '이탈 처리에 실패했습니다.' }, { status: 500 });
  }
}
