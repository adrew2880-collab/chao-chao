import { DECLARE_MS, DOUBT_MS } from './constants';
import {
  computeWinners,
  findNextTurn,
  isGameOver,
  resolveRound,
  rollDice,
} from './gameLogic';
import type { DoubtChoice, GameAction, GameState } from './types';

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ROLL': {
      if (state.phase !== 'ROLL') return state;
      return { ...state, dice: rollDice(), phase: 'DICE_PEEK' };
    }
    case 'CONFIRM_DICE': {
      if (state.phase !== 'DICE_PEEK') return state;
      return { ...state, phase: 'DECLARE', declareDeadline: Date.now() + DECLARE_MS, autoDeclared: false };
    }
    case 'DECLARE': {
      if (state.phase !== 'DECLARE') return state;
      return { ...state, declared: action.num, phase: 'DOUBT', doubtDeadline: Date.now() + DOUBT_MS, doubtChoices: {} };
    }
    case 'DECLARE_TIMEOUT': {
      if (state.phase !== 'DECLARE') return state;
      const fallback = typeof state.dice === 'number' ? state.dice : 1 + Math.floor(Math.random() * 4);
      return {
        ...state,
        declared: fallback,
        autoDeclared: true,
        phase: 'DOUBT',
        doubtDeadline: Date.now() + DOUBT_MS,
        doubtChoices: {},
      };
    }
    case 'OPPONENT_CHOICE': {
      /* =====================================================================
       *  투표 동기화(Vote Sync) 로직
       *  -------------------------------------------------------------------
       *  실제 멀티플레이 환경에서는 각 클라이언트가 [의심]/[진행] 중 하나를
       *  "동시에·비공개로" 서버에 제출하고, 서버는 살아있는 상대 전원의 표가
       *  모인 뒤에야 한 번에 결과를 공개해야 한다(그래야 남들이 뭘 눌렀는지
       *  보고 따라 누르는 눈치싸움이 불가능해진다). 그래서 클릭 한 번에 바로
       *  결과를 내지 않고 아래 2단계로 나눠 처리한다.
       *
       *   1) 이 액션이 올 때마다 doubtChoices[플레이어id] = 'doubt'|'pass' 로
       *      "투표만" 기록한다. 화면(DOUBT 패널)에는 각 상대 카드에 어떤
       *      선택을 했는지는 숨기고 "투표 완료" 여부만 보여준다.
       *   2) 매번 투표가 기록될 때마다 opponents.every(...) 로 "살아있는
       *      상대 전원이 투표를 마쳤는가"를 확인한다.
       *        - 아직 다 모이지 않았다면 → doubtChoices만 갱신하고 대기.
       *        - 전원이 모였다면 → 그제서야 doubterIds(의심을 고른 사람
       *          id 목록)를 뽑아 resolveRound를 딱 한 번 호출해서 주사위를
       *          공개하고 결과를 계산한다.
       *  즉 "누가 제일 먼저 눌렀는가"는 결과에 전혀 영향을 주지 않고, 오직
       *  "전원이 다 눌렀는가"만 결과 공개 시점을 결정한다. 의심을 고른
       *  사람이 여럿이면(동시에 여러 명이 의심) doubterIds 배열에 전원이
       *  담겨 resolveRound에서 함께 처리된다.
       * ===================================================================== */
      if (state.phase !== 'DOUBT') return state;
      const doubtChoices: Record<number, DoubtChoice> = { ...state.doubtChoices, [action.playerIdx]: action.choice };
      const opponents = state.players.filter((p) => p.id !== state.turn && !p.eliminated);
      const allVoted = opponents.every((p) => doubtChoices[p.id]);
      if (!allVoted) return { ...state, doubtChoices }; // 아직 대기 중 — 표만 저장
      const doubterIds = opponents.filter((p) => doubtChoices[p.id] === 'doubt').map((p) => p.id);
      return resolveRound({ ...state, doubtChoices }, doubterIds); // 전원 투표 완료 → 결과 공개
    }
    case 'DOUBT_TIMEOUT': {
      if (state.phase !== 'DOUBT') return state;
      // 10초 안에 투표하지 못한 사람은 "진행(진실로 믿는다)"으로 간주하고,
      // 위와 동일한 방식으로 doubterIds를 뽑아 결과를 마감한다.
      const opponents = state.players.filter((p) => p.id !== state.turn && !p.eliminated);
      const doubtChoices: Record<number, DoubtChoice> = { ...state.doubtChoices };
      opponents.forEach((p) => {
        if (!doubtChoices[p.id]) doubtChoices[p.id] = 'pass';
      });
      const doubterIds = opponents.filter((p) => doubtChoices[p.id] === 'doubt').map((p) => p.id);
      return resolveRound({ ...state, doubtChoices }, doubterIds);
    }
    case 'RESULT_ACK': {
      /* 결과 확인 동기화 — 고정 타이머로 자동 진행하지 않는다. 살아있는 플레이어
       * 전원이 [확인했어요]를 눌러야만 다음 턴으로 넘어간다. DOUBT 투표와 같은 패턴:
       * resultAcks[플레이어id]=true 로 기록만 하고, alive.every(...)로 전원 확인이
       * 끝났는지 매번 검사한다. */
      if (state.phase !== 'RESULT') return state;
      const resultAcks = { ...state.resultAcks, [action.playerIdx]: true };
      const alive = state.players.filter((p) => !p.eliminated);
      const allAcked = alive.every((p) => resultAcks[p.id]);
      if (!allAcked) return { ...state, resultAcks }; // 아직 다 확인하지 않음 — 대기
      if (state.gameOverPending) return { ...state, resultAcks, phase: 'GAMEOVER' };
      const nextTurn = findNextTurn(state.players, state.turn);
      return {
        ...state,
        resultAcks,
        phase: 'ROLL',
        turn: nextTurn,
        dice: null,
        declared: null,
        doubtChoices: {},
        result: null,
      };
    }
    case 'SURRENDER': {
      const players = state.players.map((p) =>
        p.id === action.playerIdx ? { ...p, eliminated: true, pos: null } : p
      );
      const remaining = players.filter((p) => !p.eliminated);
      // 인원수에 따른 분기: 남은 사람이 1명뿐이면(2인전에서 한쪽이 기권한 경우 포함)
      // 그 즉시 그 사람이 승리하며 게임이 끝난다. 3~4인전에서는 기권자만 탈락(말 제거·턴
      // 제외) 처리되고, 남은 플레이어들끼리 게임이 계속 진행된다.
      if (remaining.length <= 1) {
        const winners = remaining.length === 1 ? [remaining[0].id] : computeWinners(players);
        return { ...state, players, winners, phase: 'GAMEOVER' };
      }
      if (isGameOver(players, state.podium, state.podiumScores.length)) {
        return { ...state, players, winners: computeWinners(players), phase: 'GAMEOVER' };
      }
      if (action.playerIdx === state.turn) {
        const nextTurn = findNextTurn(players, state.turn);
        return {
          ...state,
          players,
          turn: nextTurn,
          phase: 'ROLL',
          dice: null,
          declared: null,
          doubtChoices: {},
          result: null,
        };
      }
      return { ...state, players };
    }
    case 'TAUNT': {
      return { ...state, taunts: { ...state.taunts, [action.playerIdx]: action.text } };
    }
    case 'CLEAR_TAUNT': {
      if (!state.taunts[action.playerIdx]) return state;
      const taunts = { ...state.taunts };
      delete taunts[action.playerIdx];
      return { ...state, taunts };
    }
    case 'CHAT_SEND': {
      return { ...state, chatLog: [...state.chatLog, action.msg].slice(-50) };
    }
    default:
      return state;
  }
}
