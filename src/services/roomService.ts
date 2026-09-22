import type { ChatMessage, Room } from '@/lib/types';

/* =========================================================================
 *  SERVICE LAYER — 방(로비/대기실) 관련 네트워크 연동 지점
 *  -------------------------------------------------------------------------
 *  이전에는 백엔드가 없어서 이 함수들이 로컬 state만 다루는 "가짜(mock)" 구현이었다.
 *  이제 실제 Firestore 백엔드가 붙었으므로, 컴포넌트는 여전히 로컬 배열을 직접 만들지
 *  않고 이 서비스 계층을 통해서만 "네트워크로 나가야 할" 동작을 호출한다 — 다만 이제는
 *  각 함수 내부가 실제로 fetch()를 호출해 app/api/rooms/** 라우트(Admin SDK)와 통신한다.
 *
 *  "방 목록/방 상태 읽기"는 이 서비스가 아니라 useRoomsList/useRoomDoc 훅이 Firestore를
 *  직접 실시간 구독(onSnapshot)해서 처리한다 — 그래야 다른 기기의 변경이 폴링 없이
 *  즉시 반영된다. 이 서비스는 오직 "쓰기"(생성/참여/시작/채팅)만 담당한다.
 * ========================================================================= */
export const RoomService = {
  // 방 생성. 서버가 실제 방 id와 "내가 몇 번 좌석인지"(항상 0)를 내려준다.
  async createRoom(hostName: string, roomName: string, locked: boolean): Promise<{ room: Room; myPlayerId: number }> {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName, roomName, locked }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `방 생성에 실패했습니다 (${res.status})`);
    }
    return res.json();
  },

  // 방 참여. 서버가 정원을 확인하고 참가자 목록에 나를 추가한 뒤, 내 좌석 번호를 내려준다.
  async joinRoom(roomId: string, name: string): Promise<{ myPlayerId: number; roomName: string }> {
    const res = await fetch(`/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `방 참여에 실패했습니다 (${res.status})`);
    }
    return res.json();
  },

  // 명시적으로 방을 나갈 때(예: 대기실의 "← 로비로" 버튼) 호출. 탭을 닫을 때
  // 자동으로 나가는 것(useLeaveOnUnload, navigator.sendBeacon)과 서버 쪽 로직은
  // 동일한 /leave 라우트를 공유하지만, 이건 사용자가 버튼을 눌러 페이지 안에
  // 머무른 채로 나가는 경우라 평범한 fetch로 보낸다. 실패해도 화면 전환 자체를
  // 막지는 않는다(어차피 결국 유령 방 청소가 정리한다) — 호출부에서 그냥
  // .catch(console.error)로 무시하고 진행하면 된다.
  async leaveRoom(roomId: string, myPlayerId: number): Promise<void> {
    await fetch(`/api/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: myPlayerId }),
    });
  },

  // 대기실 방장이 [게임 시작]을 누르면 호출. 서버가 모인 인원 그대로 gameState를
  // 만들고 방을 'playing' 상태로 바꾼다 — 이후 모든 클라이언트는 useRoomDoc 구독을
  // 통해 자동으로 게임 화면으로 전환된다(폴링 없이 실시간으로).
  async startGame(roomId: string): Promise<void> {
    const res = await fetch(`/api/rooms/${roomId}/start`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `게임 시작에 실패했습니다 (${res.status})`);
    }
  },

  // 대기실(로비) 채팅 전송. 인게임 채팅과 달리 아직 gameState가 없으므로 별도 라우트를 쓴다.
  async sendLobbyChat(roomId: string, sender: { name: string; emoji: string }, text: string): Promise<void> {
    const res = await fetch(`/api/rooms/${roomId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sender.name, emoji: sender.emoji, text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `채팅 전송에 실패했습니다 (${res.status})`);
    }
  },

  // 로비의 "⋮ → 방 삭제(관리자)" 메뉴에서 호출. 비밀번호는 여기서 검사하지 않고
  // 그대로 서버에 넘기며, 실제 검증과 삭제는 admin-delete 라우트(Admin SDK)가
  // 전담한다 — 비밀번호 비교 로직 자체를 클라이언트 번들에 두지 않기 위해서다.
  async adminDeleteRoom(roomId: string, password: string): Promise<void> {
    const res = await fetch(`/api/rooms/${roomId}/admin-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `방 삭제에 실패했습니다 (${res.status})`);
    }
  },

  // 순수 헬퍼(네트워크 호출 아님): 채팅 메시지 객체 하나를 만든다. 인게임 채팅(로컬
  // dispatch로 CHAT_SEND 액션에 실어 보냄)과 대기실 채팅 양쪽에서 재사용된다.
  makeChatMessage(sender: { name: string; emoji: string }, text: string): ChatMessage {
    return { id: Date.now() + '-' + Math.random().toString(36).slice(2), name: sender.name, emoji: sender.emoji, text };
  },
};
