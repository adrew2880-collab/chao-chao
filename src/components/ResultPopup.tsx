'use client';

import type { Dispatch } from 'react';
import { canAct } from '@/lib/constants';
import type { DoubtChoice, GameAction, Player, RoundResult } from '@/lib/types';
import { GameService } from '@/services/gameService';

export function ResultPopup({
  dispatch,
  result,
  opponents,
  doubtChoices,
  aliveInResult,
  resultAcks,
  ackedCount,
  testMode,
}: {
  dispatch: Dispatch<GameAction>;
  result: RoundResult;
  opponents: Player[];
  doubtChoices: Record<number, DoubtChoice>;
  aliveInResult: Player[];
  resultAcks: Record<number, boolean>;
  ackedCount: number;
  testMode: boolean;
}) {
  return (
    // 결과 팝업: 화면 정중앙보다 살짝 위쪽에 고정(position:fixed, CSS 참고)해서 중앙 보드의
    // 이동·추락 애니메이션이 뒤로 계속 보이게 했고, 글씨/카드 크기를 크게 키웠다.
    // 의심이 없었다면 블러핑 게임 특성상 주사위 값 자체를 공개하지 않는다.
    <div className="result-overlay">
      <div className="card result-card">
        <div className="result-icon">{!result.doubted ? '🤐' : result.truth ? '✅' : '❌'}</div>
        <div className="headline">
          {!result.doubted ? '아무도 의심하지 않았습니다' : result.truth ? '진실이었습니다!' : '거짓말이었습니다!'}
        </div>

        {/* 실제 주사위 결과 — 선언 값과 비교하는 문구 없이 "진짜 결과"만 간결하게 표시 */}
        {result.doubted && (
          <div className="dice-reveal">
            🎲 실제 주사위: <span className="dice-value">{result.dice === 'X' ? '🐊 X' : result.dice}</span>
          </div>
        )}

        {/* 플레이어별 투표 결과 목록: 이번 라운드에서 선언자를 제외한 상대 전원이
            "의심"과 "진행" 중 무엇을 골랐는지 한눈에 보여준다.
            - opponents 는 GameScreen에서 이미 계산해둔 "players 중 이번 선언자가 아니고
              탈락하지 않은 사람들" 배열을 그대로 재사용한다.
            - doubtChoices 는 { 플레이어id: 'doubt' | 'pass' } 형태의 이번 라운드 최종 투표
              기록이다. reducer가 다음 턴으로 넘어갈 때(RESULT_ACK 전원 완료)까지는 초기화하지
              않으므로, RESULT 화면이 떠 있는 동안엔 그대로 읽어서 매핑해도 안전하다.
            - opponents.map(...) 으로 각 플레이어를 순회하며 doubtChoices[p.id] 값에 따라
              "의심 🤔" 또는 "진행 🟢" 뱃지를 렌더링한다. */}
        <div className="vote-list">
          {opponents.map((p) => {
            const doubtedByThem = doubtChoices[p.id] === 'doubt';
            return (
              <span key={p.id} className={'vote-badge' + (doubtedByThem ? ' doubt' : ' pass')}>
                {p.emoji} {p.name}: {doubtedByThem ? '의심 🤔' : '진행 🟢'}
              </span>
            );
          })}
        </div>

        <p className="result-detail">{result.fallInfos.length ? '🐊 ' : '🏃 '}{result.text}</p>

        {/* 결과 확인 동기화 + 권한 분리: 살아있는 플레이어 전원이 [확인했어요]를 눌러야만
            (RESULT_ACK) 다음 턴으로 넘어간다. 단, 일반 모드에서는 canAct()가 "나"
            (MY_PLAYER_ID)의 버튼만 클릭 가능하게 막아서, 남의 확인 버튼을 대신 눌러줄 수
            없다 — 테스트 모드일 때만 전원 클릭 가능해진다. */}
        <div className="ack-row">
          {aliveInResult.map((p) => {
            const acked = !!resultAcks[p.id];
            const clickable = canAct(p.id, testMode);
            return (
              <button
                key={p.id}
                className={'pill-btn' + (acked ? ' ghost' : '')}
                disabled={acked || !clickable}
                onClick={() => GameService.ackResult(dispatch, p.id)}
              >
                {acked ? `✅ ${p.emoji} 확인함` : clickable ? `${p.emoji} 확인했어요` : `${p.emoji} 대기 중…`}
              </button>
            );
          })}
        </div>
        <p className="mono ack-progress">{ackedCount}/{aliveInResult.length} 확인 완료</p>
      </div>
    </div>
  );
}
