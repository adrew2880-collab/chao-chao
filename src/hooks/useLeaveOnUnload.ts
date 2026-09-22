'use client';

// 브라우저 탭을 닫거나 다른 사이트로 이동할 때 "나 이 방에서 나갑니다"를 서버에
// 알린다. beforeunload 핸들러 안에서 일반 fetch()를 쓰면 페이지가 실제로 닫히는
// 중간에 요청이 취소될 수 있어 신뢰할 수 없으므로, 브라우저가 페이지를 언로드한
// 뒤에도 전송을 보장하는 navigator.sendBeacon()을 쓴다(Firestore Realtime Database의
// onDisconnect() 같은 서버 푸시형 연결 감지 기능이 Firestore에는 없어서, 이 방식이
// 사실상 유일하게 신뢰할 수 있는 "정상 종료" 신호다 — 그래도 sendBeacon조차 못 보내고
// 죽는 경우(네트워크 단절, 강제종료)를 대비해 하트비트+유령 방 청소가 최종 안전망
// 역할을 한다).
//
// pagehide와 beforeunload 둘 다 등록하는 이유: 브라우저/OS별로 둘 중 하나만 확실히
// 발동하는 경우가 있어(특히 모바일) 중복 등록으로 커버리지를 높인다 — leave 라우트가
// 멱등적(이미 나간 좌석은 조용히 무시)이라 두 번 호출돼도 안전하다.
import { useEffect } from 'react';

export function useLeaveOnUnload(roomId: string | null, myPlayerId: number) {
  useEffect(() => {
    if (!roomId) return;

    function sendLeaveBeacon() {
      if (!roomId) return;
      const blob = new Blob([JSON.stringify({ playerId: myPlayerId })], { type: 'application/json' });
      navigator.sendBeacon(`/api/rooms/${roomId}/leave`, blob);
    }

    window.addEventListener('pagehide', sendLeaveBeacon);
    window.addEventListener('beforeunload', sendLeaveBeacon);
    return () => {
      window.removeEventListener('pagehide', sendLeaveBeacon);
      window.removeEventListener('beforeunload', sendLeaveBeacon);
      // 주의: 여기서 sendLeaveBeacon()을 호출하지 않는다 — 이 cleanup은 컴포넌트가
      // 리렌더/언마운트될 때도 실행되는데(예: WaitingRoom → GameScreen으로 화면
      // 전환), 그런 "같은 방 안에서의 화면 전환"까지 방을 나가는 것으로 처리하면
      // 안 되기 때문이다. 진짜 이탈은 오직 pagehide/beforeunload 이벤트가 실제로
      // 발생했을 때만 감지한다.
    };
  }, [roomId, myPlayerId]);
}
