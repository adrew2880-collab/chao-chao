// app/api/rooms/[roomId]/chat/route.ts
// 대기실(로비) 채팅 메시지 전송. 인게임 채팅(CHAT_SEND)은 gameState 안의 chatLog를
// 다루는 games/[roomId]/action 라우트를 통해 gameReducer로 처리되지만, 대기실
// 채팅은 아직 게임이 시작되기 전이라 room 문서의 lobbyChat 배열에 직접 추가한다.
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import type { ChatMessage } from '@/lib/types';

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? '').slice(0, 300).trim();
    if (!text) return NextResponse.json({ error: '빈 메시지입니다.' }, { status: 400 });

    const msg: ChatMessage = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2),
      name: typeof body.name === 'string' ? body.name : '',
      emoji: typeof body.emoji === 'string' ? body.emoji : '',
      text,
    };

    const adminDb = getAdminDb();
    const ref = adminDb.collection('rooms').doc(roomId);
    // 배열 필드에 원소 하나를 원자적으로 추가한다 — 동시에 여러 명이 채팅을 보내도
    // 서로의 메시지를 덮어쓰지 않는다(트랜잭션 없이도 arrayUnion 자체가 원자적이다).
    await ref.update({ lobbyChat: FieldValue.arrayUnion(msg) });

    return NextResponse.json({ ok: true, msg });
  } catch (err) {
    console.error('[api/rooms/chat] 전송 실패:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: '채팅 전송에 실패했습니다.' }, { status: 500 });
  }
}
