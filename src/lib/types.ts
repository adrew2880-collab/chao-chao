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

export type ChatMessage = { id: string | number; name: string; emoji: string; text: string };

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
  | { type: 'CHAT_SEND'; msg: ChatMessage };

export type Room = {
  id: string;
  name: string;
  host: string;
  locked: boolean;
  players: number;
  createdAt: number;
};
