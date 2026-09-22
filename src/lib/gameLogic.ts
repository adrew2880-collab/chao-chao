import { BRIDGE_LEN, TOTEMS, tokensPerPlayerFor, podiumSizeFor } from './constants';
import type { DiceFace, GameState, Player } from './types';

export function rollDice(): DiceFace {
  // 1~4 또는 'X'(실패) 중 하나를 균등 확률로 반환
  const faces: DiceFace[] = [1, 2, 3, 4, 'X'];
  return faces[Math.floor(Math.random() * faces.length)];
}

/* =========================================================================
 *  GAME STATE — 초기 상태 생성
 *
 *  턴 흐름 요약:
 *   ROLL       현재 차례 플레이어가 주사위를 굴릴 차례. 버튼을 누르면 DICE_PEEK로 이동.
 *   DICE_PEEK  주사위 결과는 state.dice 에만 저장되고, 화면엔 "몰래 확인" 모달만 뜬다.
 *              확인 버튼을 누르면(CONFIRM_DICE) DECLARE 로 이동하며 3초 타이머 시작.
 *   DECLARE    1~4 중 하나를 선언(진실/거짓 무관). 3초 안에 못 누르면 DECLARE_TIMEOUT 이
 *              자동으로 선언을 대신 채워 넣는다.
 *   DOUBT      선언된 숫자가 상단에 크게 뜨고, 다른 플레이어들에게 10초 동안
 *              [의심하기]/[진행하기] 투표권이 주어진다. 각자의 선택은 즉시 반영되지 않고
 *              doubtChoices 에만 기록되며, 살아있는 상대 전원이 투표를 마치거나(모두 마치면
 *              그 즉시) 10초가 지나면(DOUBT_TIMEOUT, 미투표자는 "진행"으로 간주) 그제서야
 *              한 번에 결과가 계산·공개된다. 자세한 동기화 로직은 gameReducer의
 *              OPPONENT_CHOICE 케이스 주석을 참고.
 *   RESULT     계산된 결과(전진/추락, 시상대 획득 여부)를 배너로 보여주고, 참여자 전원이
 *              [확인했어요]를 눌러야(RESULT_ACK) 다음 턴으로 넘어가거나, 종료 조건을
 *              만족했으면(시상대가 다 찼거나 더 진행할 수 있는 플레이어가 없으면) GAMEOVER로
 *              이동한다. 고정 타이머로 자동 진행하지 않는다.
 *   GAMEOVER   최고 점수 플레이어(동점이면 공동 우승)를 승자로 표시한 뒤 로비로 리셋.
 * ========================================================================= */
export function makeInitialGame(myName: string, playerCount: number): GameState {
  // playerCount: 대기실/테스트 모드에서 2~4인으로 조절 가능. 기본값은 4인(TOTEMS 전체).
  const count = Math.min(4, Math.max(2, playerCount || 4));
  const podiumSize = podiumSizeFor(count);
  const tokensPerPlayer = tokensPerPlayerFor(count); // 2인→5개, 3인→6개, 4인→7개
  const players: Player[] = TOTEMS.slice(0, count).map((t, i) => ({
    id: i,
    name: i === 0 ? (myName && myName.trim() ? myName.trim() : '나') : t.name,
    emoji: t.emoji,
    home: 0,
    dead: 0,
    score: 0,
    waiting: tokensPerPlayer,
    pos: null,
    eliminated: false,
  }));
  return {
    players,
    turn: 0,
    phase: 'ROLL',
    dice: null,
    declared: null,
    autoDeclared: false,
    declareDeadline: null,
    doubtDeadline: null,
    doubtChoices: {},
    tokensPerPlayer,
    podium: [],
    podiumScores: Array.from({ length: podiumSize }, (_, i) => i + 1),
    result: null,
    resultAcks: {},
    winners: [],
    gameOverPending: false,
    taunts: {},
    chatLog: [],
    resultId: 0,
  };
}

export function advanceToken(player: Player, steps: number): Player & { arrived: boolean } {
  // pos===null 이면 아직 대기 중인 말 하나가 다리 위로 새로 올라오는 것
  const wasWaiting = player.pos === null;
  let pos: number | null = (player.pos == null ? 0 : player.pos) + steps;
  let waiting = player.waiting,
    home = player.home;
  let arrived = false;
  if (wasWaiting) waiting -= 1;
  if (pos >= BRIDGE_LEN) {
    home += 1;
    pos = null; // 도착했으니 더 이상 다리 위 위치가 없다
    arrived = true;
  }
  return { ...player, pos, waiting, home, arrived };
}

export function killWaitingOrActive(player: Player): Player {
  // "대기 중인 말"이 우선적으로 죽는다. 대기 말이 없으면 다리 위의 말이 죽는다.
  if (player.waiting > 0) return { ...player, waiting: player.waiting - 1, dead: player.dead + 1, fellPos: null };
  if (player.pos != null) return { ...player, pos: null, dead: player.dead + 1, fellPos: player.pos };
  return player;
}

export function killActive(player: Player): Player {
  // 다리 위 말을 우선적으로 죽인다(선언자가 거짓을 들켰을 때).
  if (player.pos != null) return { ...player, pos: null, dead: player.dead + 1, fellPos: player.pos };
  if (player.waiting > 0) return { ...player, waiting: player.waiting - 1, dead: player.dead + 1, fellPos: null };
  return player;
}

export function hasPlayableToken(p: Player): boolean {
  return p.waiting > 0 || p.pos != null;
}

export function findNextTurn(players: Player[], from: number): number {
  for (let step = 1; step <= players.length; step++) {
    const idx = (from + step) % players.length;
    const p = players[idx];
    if (!p.eliminated && hasPlayableToken(p)) return idx;
  }
  return from;
}

export function isGameOver(players: Player[], podium: number[], podiumSize: number): boolean {
  // 시상대 자리가 모두 찼거나, 더 이상 턴을 진행할 수 있는(말이 남은) 플레이어가 없으면 종료.
  if (podium.length >= podiumSize) return true;
  return players.every((p) => p.eliminated || !hasPlayableToken(p));
}

export function computeWinners(players: Player[]): number[] {
  // 시상대 점수 합이 가장 높은 플레이어(들)를 승자로 삼는다. 동점이면 공동 우승.
  const maxScore = players.reduce((m, p) => Math.max(m, p.score), 0);
  return players.filter((p) => p.score === maxScore).map((p) => p.id);
}

export function resolveRound(state: GameState, doubterIds: number[] | null): GameState {
  // doubterIds: 이번 판에서 "의심"을 선택한 플레이어 id 배열.
  //             null/빈 배열이면 "전원 진행"으로 처리한다.
  const declarerIdx = state.turn;
  const declarer0 = state.players[declarerIdx];
  const declared = state.declared as number;
  const dice = state.dice;
  let players: Player[] = state.players.map((p) => ({ ...p, fellPos: null, arrived: false }));
  let podium = state.podium.slice();
  const fallInfos: { playerIdx: number; pos: number }[] = []; // 이번 판에 늪으로 떨어진 말들(동시에 여러 명일 수 있음)
  const gains: string[] = []; // 이번 판에 시상대에 오른 플레이어들의 점수 획득 로그
  let text = '';

  // 말을 steps칸 전진시키고, 9칸을 다 건너 도착했다면 시상대(podium) 빈 자리를 채운다.
  // 자리 값은 state.podiumScores 에서 가져오는데, 앞 자리일수록 점수가 낮고 뒤 자리일수록
  // 높다(늦게 도착할수록 고득점 — 오리지널 룰의 역순 점수 방식).
  function claim(idx: number, steps: number) {
    const res = advanceToken(players[idx], steps);
    players[idx] = res;
    if (res.arrived && podium.length < state.podiumScores.length) {
      podium.push(idx);
      const pts = state.podiumScores[podium.length - 1];
      players[idx] = { ...players[idx], score: players[idx].score + pts };
      gains.push(`${players[idx].name} 🏆+${pts}점(${podium.length}번 자리)`);
    }
  }
  // 말 한 마리를 늪에 빠뜨린다. preferWaiting=true면 대기 말을 우선, false면 다리 위 말을 우선.
  function drown(idx: number, preferWaiting: boolean) {
    const after = preferWaiting ? killWaitingOrActive(players[idx]) : killActive(players[idx]);
    players[idx] = after;
    if (after.fellPos != null) fallInfos.push({ playerIdx: idx, pos: after.fellPos });
  }

  // doubted/truth: 의심이 있었는지, 있었다면 선언이 진실이었는지.
  // 아무도 의심하지 않았다면 주사위 값은 애초에 공개되지 않는다 — 블러핑 게임의 핵심이므로
  // 여기서도 truth는 null로 두고, 화면에는 dice 값 자체를 보여주지 않는다.
  const doubted = !!(doubterIds && doubterIds.length);
  const truth = doubted ? typeof dice === 'number' && dice === declared : null;

  if (!doubted) {
    claim(declarerIdx, declared);
    text = `${declarer0.name}의 말이 ${declared}칸 전진합니다.`;
  } else {
    const ids = doubterIds as number[];
    const names = ids.map((id) => state.players[id].name).join(', ');
    if (truth) {
      // 선언이 진실이었다 → 의심한 사람들(전원)의 대기 말이 늪에 빠지고, 선언자는 전진한다.
      ids.forEach((id) => drown(id, true));
      claim(declarerIdx, declared);
      text = `${names}의 말이 늪에 빠지고, ${declarer0.name}의 말이 ${declared}칸 전진합니다.`;
    } else {
      // 선언이 거짓이었다 → 선언자의 다리 위 말이 늪에 빠지고, 의심한 사람들(전원)이 1칸씩 전진한다.
      drown(declarerIdx, false);
      ids.forEach((id) => claim(id, 1));
      text = `${declarer0.name}의 말이 늪에 빠지고, ${names}의 말이 1칸씩 전진합니다.`;
    }
  }
  if (gains.length) text += ' ' + gains.join(', ');

  const over = isGameOver(players, podium, state.podiumScores.length);
  return {
    ...state,
    players,
    podium,
    phase: 'RESULT',
    result: { text, fallInfos, doubted, truth, dice, declared },
    resultAcks: {}, // 새 결과가 떴으니 "확인했어요" 체크도 초기화
    winners: over ? computeWinners(players) : [],
    gameOverPending: over,
    resultId: state.resultId + 1,
  };
}
