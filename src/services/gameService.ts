import type { ActionSender, ChatMessage, DoubtChoice } from '@/lib/types';

/* GameService — 인게임 액션의 네트워크 연동 지점.
 *
 * 각 함수는 ActionSender 타입의 send 함수 하나만 받아서 액션 객체를 넘긴다.
 * send의 실제 구현은 호출부(컴포넌트)가 아니라 GameScreen이 testMode 여부로
 * 결정해서 넘겨준다:
 *   - 테스트 모드(LocalGameScreen)  → send = useReducer의 dispatch (그대로 로컬 반영)
 *   - 실제 방(RemoteGameScreen)     → send = POST /api/games/[roomId]/action (서버가
 *                                      gameReducer를 실행하고, 결과는 Firestore
 *                                      onSnapshot을 통해 되돌아와 화면에 반영된다)
 * 이 파일의 함수들은 그 차이를 몰라도 되고, 항상 "액션 객체 하나를 만들어 send에
 * 넘긴다"는 동일한 방식으로 호출된다 — 컴포넌트 호출부도 전혀 달라지지 않는다.
 */
export const GameService = {
  rollDice(send: ActionSender) {
    send({ type: 'ROLL' });
  },
  confirmDicePeek(send: ActionSender) {
    send({ type: 'CONFIRM_DICE' });
  },
  declare(send: ActionSender, num: number) {
    send({ type: 'DECLARE', num });
  },
  vote(send: ActionSender, playerIdx: number, choice: DoubtChoice) {
    send({ type: 'OPPONENT_CHOICE', playerIdx, choice });
  },
  ackResult(send: ActionSender, playerIdx: number) {
    send({ type: 'RESULT_ACK', playerIdx });
  },
  surrender(send: ActionSender, playerIdx: number) {
    send({ type: 'SURRENDER', playerIdx });
  },
  taunt(send: ActionSender, playerIdx: number, text: string) {
    send({ type: 'TAUNT', playerIdx, text });
  },
  clearTaunt(send: ActionSender, playerIdx: number) {
    send({ type: 'CLEAR_TAUNT', playerIdx });
  },
  declareTimeout(send: ActionSender) {
    send({ type: 'DECLARE_TIMEOUT' });
  },
  doubtTimeout(send: ActionSender) {
    send({ type: 'DOUBT_TIMEOUT' });
  },
  sendChat(send: ActionSender, msg: ChatMessage) {
    send({ type: 'CHAT_SEND', msg });
  },
};
