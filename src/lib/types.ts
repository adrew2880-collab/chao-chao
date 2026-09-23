// 게임 전체에서 공유하는 타입 정의.
// 원래 Artifact(단일 HTML) 버전은 순수 JS였기 때문에 타입이 없었지만, 실제 프로젝트로
// 옮기면서 핵심 데이터 구조에는 타입을 붙였다.

export type Totem = { emoji: string; name: string };

export type Player = {
  id: number;
  name: string;
  emoji: string;
  home: number;       // 9칸을 건너 도착한 말의 개수
  dead: number;        // 늪에 빠져 죽은 말의 개수
  score: number;       // 시상대에서 획득한 누적 점수
  waiting: number;      // 아직 다리에 오르지 않은 대기 말 개수
  pos: number | null;   // 현재 다리 위 활성 말의 위치(1~9), 없으면 null
  eliminated: boolean;  // 기권/탈락 여부
  fellPos?: number | null; // 라운드 계산 중 임시로 쓰이는 "이번에 떨어진 위치"
  arrived?: boolean;      // 라운드 계산 중 임시로 쓰이는 "이번에 도착했는가"
};

export type Phase = 'ROLL' | 'DICE_PEEK' | 'DECLARE' | 'DOUBT' | 'RESULT' | 'GAMEOVER';

export type DiceFace = 1 | 2 | 3 | 4 | 'X';

export type FallInfo = { playerIdx: number; pos: number };

export type RoundResult = {
  text: string;
  fallInfos: FallInfo[];
  doubted: boolean;
  truth: boolean | null;
  dice: DiceFace | null;
  declared: number | null;
};

export type ChatMessage = { id: string | number; name: string; emoji: string; text: string; system?: boolean };

export type DoubtChoice = 'doubt' | 'pass';

export type GameState = {
  players: Player[];
  turn: number;
  phase: Phase;
  dice: DiceFace | null;
  declared: number | null;
  autoDeclared: boolean;
  declareDeadline: number | null;
  doubtDeadline: number | null;
  doubtChoices: Record<number, DoubtChoice>;
  tokensPerPlayer: number;
  podium: number[];           // 도착 순서대로 쌓이는 플레이어 id 배열
  podiumScores: number[];     // 역순 배점: 앞 칸=낮은 점수, 뒤 칸=높은 점수
  result: RoundResult | null;
  resultAcks: Record<number, boolean>;
  winners: number[];
  gameOverPending: boolean;
  taunts: Record<number, string | undefined>;
  chatLog: ChatMessage[];
  resultId: number;
};

export type GameAction =
  | { type: 'ROLL' }
  | { type: 'CONFIRM_DICE' }
  | { type: 'DECLARE'; num: number }
  | { type: 'DECLARE_TIMEOUT' }
  | { type: 'OPPONENT_CHOICE'; playerIdx: number; choice: DoubtChoice }
  | { type: 'DOUBT_TIMEOUT' }
  | { type: 'RESULT_ACK'; playerIdx: number }
  | { type: 'SURRENDER'; playerIdx: number }
  | { type: 'TAUNT'; playerIdx: number; text: string }
  | { type: 'CLEAR_TAUNT'; playerIdx: number }
  | { type: 'CHAT_SEND'; msg: ChatMessage }
  // 현재 턴 플레이어가 남은 말이 하나도 없어(waiting===0 && pos===null) 아무 행동도
  // 할 수 없을 때 턴만 다음 사람에게 넘긴다. SURRENDER(기권)와 달리 eliminated를
  // 세우지 않는다 — 그래서 이후 다른 사람의 선언에 대한 의심/승낙 투표권은 계속
  // 유지된다(요구사항: "남은 말이 0개라도 투표에는 참여할 수 있어야 한다").
  | { type: 'SKIP_EMPTY_TURN' };

// 액션을 어딘가로 "보내는" 함수의 공통 타입. 로컬(테스트 모드)에서는 이게 그냥
// useReducer의 dispatch이고, 원격(실제 방)에서는 서버 API로 POST하는 함수다 —
// 컴포넌트 입장에서는 둘 다 "액션 객체 하나를 넘기면 끝"이라는 점이 동일하다.
export type ActionSender = (action: GameAction) => void;

export type Participant = {
  name: string;
  emoji: string;
  // 대기실(로비)에서 나간 참가자의 자리를 표시하는 "묘비" 플래그. participants는
  // 배열 인덱스가 곧 좌석 번호(myPlayerId)라서, 중간에 나간 사람을 배열에서
  // splice로 지워버리면 그 뒤 인덱스에 있던 사람들의 좌석 번호가 전부 밀려 서버와
  // 클라이언트가 서로 다른 좌석 번호를 들고 있게 된다(식별 불일치 버그). 그래서
  // 실제로 배열에서 제거하는 대신 이 플래그만 세워 "빈 자리"로 남기고, 다음
  // 참여자가 그 자리를 재사용한다 — src/lib/roomCleanup.ts, join/leave 라우트 참고.
  left?: boolean;
};

export type RoomStatus = 'waiting' | 'playing';

export type Room = {
  id: string;
  name: string;
  host: string;
  locked: boolean;
  status: RoomStatus;
  participants: Participant[];
  lobbyChat: ChatMessage[];
  gameState: GameState | null;
  createdAt: number;
  // 이 방에 마지막으로 "의미 있는 활동"(생성/참여/시작/채팅/인게임 액션/하트비트)이
  // 있었던 시각(ms). 유령 방 청소(roomCleanup.ts)가 이 값을 기준으로 오래 방치된
  // 방을 찾아 지운다.
  lastActiveAt: number;
};
