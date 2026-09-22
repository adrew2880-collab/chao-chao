import type { Dispatch } from 'react';
import type { ChatMessage, DoubtChoice, GameAction } from '@/lib/types';

/* GameService — 인게임 액션의 네트워크 연동 지점.
 * 지금은 각 함수가 그냥 로컬 dispatch를 호출할 뿐이지만, 실제 서버가 생기면 이
 * 함수들 내부에서 socket.emit으로 서버에 액션을 보내고, 서버가 다시 내려주는
 * "다음 상태"를 reducer가 받아 반영하는 구조로 바뀔 자리다.
 *
 *   rollDice        → socket.emit('game:roll', …)
 *   confirmDicePeek → socket.emit('game:confirmPeek', …)
 *   declare         → socket.emit('game:declare', …)
 *   vote            → socket.emit('game:vote', …)      (의심/진행)
 *   ackResult       → socket.emit('game:ack', …)        (확인했어요)
 *   surrender       → socket.emit('game:surrender', …)
 */
export const GameService = {
  rollDice(dispatch: Dispatch<GameAction>) {
    dispatch({ type: 'ROLL' });
  },
  confirmDicePeek(dispatch: Dispatch<GameAction>) {
    dispatch({ type: 'CONFIRM_DICE' });
  },
  declare(dispatch: Dispatch<GameAction>, num: number) {
    dispatch({ type: 'DECLARE', num });
  },
  vote(dispatch: Dispatch<GameAction>, playerIdx: number, choice: DoubtChoice) {
    dispatch({ type: 'OPPONENT_CHOICE', playerIdx, choice });
  },
  ackResult(dispatch: Dispatch<GameAction>, playerIdx: number) {
    dispatch({ type: 'RESULT_ACK', playerIdx });
  },
  surrender(dispatch: Dispatch<GameAction>, playerIdx: number) {
    dispatch({ type: 'SURRENDER', playerIdx });
  },
  taunt(dispatch: Dispatch<GameAction>, playerIdx: number, text: string) {
    dispatch({ type: 'TAUNT', playerIdx, text });
  },
  sendChat(dispatch: Dispatch<GameAction>, msg: ChatMessage) {
    dispatch({ type: 'CHAT_SEND', msg });
  },
};
