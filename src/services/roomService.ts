import type { ChatMessage, Room } from '@/lib/types';

/* =========================================================================
 *  SERVICE LAYER — Vercel 배포/실제 서버(API·WebSocket) 연동 지점
 *  -------------------------------------------------------------------------
 *  지금은 백엔드(방/채팅 저장소)가 없어서 아래 함수들이 로컬 상태만 다루는
 *  "가짜(mock)" 구현이다. 컴포넌트는 로컬 배열을 직접 만들지 않고 항상 이 서비스
 *  계층을 통해서만 "네트워크로 나가야 할" 동작을 호출한다 — 나중에 실제 API Route나
 *  WebSocket 서버가 생기면 호출부(컴포넌트)는 건드리지 않고 이 파일 내부만
 *  fetch()/socket.emit() 등으로 교체하면 된다.
 *
 *  실제 연동 시 예상 매핑:
 *    RoomService.createRoom      → POST /api/rooms
 *    RoomService.makeChatMessage → socket.emit('room:chat', …) / 'game:chat'
 * ========================================================================= */
export const RoomService = {
  createRoom(hostName: string, roomName: string, locked: boolean): Room {
    // 서버가 없으므로 방 id를 클라이언트에서 임시로 발급한다. 실제 연동 시에는
    // 서버가 돌려주는 id를 그대로 쓰게 된다.
    return { id: 'room-' + Date.now(), name: roomName, host: hostName, locked, players: 1, createdAt: Date.now() };
  },
  makeChatMessage(sender: { name: string; emoji: string }, text: string): ChatMessage {
    return { id: Date.now() + '-' + Math.random().toString(36).slice(2), name: sender.name, emoji: sender.emoji, text };
  },
};
