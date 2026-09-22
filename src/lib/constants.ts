import type { Totem } from './types';

export const BRIDGE_LEN = 9;          // 징검다리 칸 수
export const DECLARE_MS = 3000;       // 숫자 선언 제한시간
export const DOUBT_MS = 10000;        // 의심/진행 투표 제한시간
export const TAUNT_MS = 2200;         // 도발 말풍선 노출 시간

// 참여 인원에 따라 1인당 말 개수가 달라진다: 2인→5개, 3인→6개, 4인→7개.
export function tokensPerPlayerFor(playerCount: number): number {
  return playerCount + 3;
}

// 시상대 칸 수 = 참여 인원 + 3 (2인→5칸, 3인→6칸, 4인→7칸).
// 점수는 "역순" — 1번째로 도착한 말은 1번 자리·1점, 2번째는 2번 자리·2점 ... 이런 식으로
// 늦게 도착할수록(뒤 칸일수록) 더 높은 점수를 받는다. 오리지널 룰 반영.
export function podiumSizeFor(playerCount: number): number {
  return playerCount + 3;
}

// 테스트 모드(핫시트) 전용 상수: 테스트 모드는 항상 로컬 브라우저 한 명이 0번 자리부터
// 모든 좌석을 직접 조작하는 모의 플레이라서, "나"는 언제나 0번으로 고정해도 된다.
// 실제(원격) 멀티플레이에서는 이 값을 쓰지 않고, 방 생성/참여 API가 각 기기에 내려주는
// myPlayerId를 컴포넌트 props로 그대로 전달해서 쓴다 — 기기마다 내 좌석 번호가 다르기 때문.
export const TEST_MODE_MY_PLAYER_ID = 0;

/* =========================================================================
 *  권한 분리(canAct) — "내 클릭 vs 남의 클릭 방지"
 *  -------------------------------------------------------------------------
 *  실제 멀티플레이라면 각자의 브라우저(클라이언트)는 자기 자신의 좌석(myPlayerId)
 *  버튼만 눌러서 서버로 액션을 보낼 수 있고, 남의 좌석 버튼은 애초에 "내 화면"에
 *  없거나 비활성 상태여야 한다. 이 함수 하나가 그 규칙을 담당한다.
 *
 *  myPlayerId는 호출부(컴포넌트)에서 넘겨받는다 — 테스트 모드에서는 TEST_MODE_MY_PLAYER_ID(0),
 *  실제 방에서는 서버가 방 생성/참여 시점에 내려준 내 좌석 번호다.
 *
 *  '테스트 모드(핫시트)'가 켜져 있을 때만 예외적으로 로컬 유저 한 명이 모든 좌석을
 *  대신 조작할 수 있다(모의 멀티플레이 테스트용). 이 규칙은 두 군데에 적용된다:
 *    1) DOUBT 단계의 의심/진행 투표 버튼
 *    2) RESULT 단계의 "확인했어요" 버튼
 *  항복(SURRENDER)은 이 규칙보다 더 엄격해서, 테스트 모드 여부와 상관없이 언제나
 *  나(myPlayerId) 본인에게만 적용된다 — GameScreenView의 handleSurrender 주석 참고.
 * ========================================================================= */
export function canAct(playerId: number, testMode: boolean, myPlayerId: number): boolean {
  return testMode || playerId === myPlayerId;
}

export const TOTEMS: Totem[] = [
  { emoji: '🐵', name: '몽키' },
  { emoji: '🐯', name: '타이거' },
  { emoji: '🐶', name: '울프독' },
  { emoji: '🐱', name: '캣' },
];

export const TAUNTS = ['개못하네 ㅋㅋ', '이것밖에 못해?', '줴줴이야'];

/* =========================================================================
 *  TEST MODE FLAG
 *  정식 론칭 시 이 값 하나만 false로 바꾸면 로비의 테스트 모드 패널이
 *  통째로 사라진다(Lobby 컴포넌트의 {isTestMode && (...)} 블록 참고).
 *  게임 자체 로직(턴 진행, 인원수 대응 등)은 이 플래그와 무관하게 항상 동작한다.
 * ========================================================================= */
export const isTestMode = true;
