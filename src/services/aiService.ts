/* AiService — 클라이언트가 AI Gateway를 "직접" 호출하지 않고 반드시 우리 서버의
 * API 라우트(app/api/ai/*)를 거치도록 감싸는 서비스 계층.
 *
 * AI_GATEWAY_API_KEY는 서버 환경변수라 브라우저 번들에는 절대 포함되지 않는다 —
 * 그래서 클라이언트는 이 fetch 래퍼로만 AI 기능을 사용할 수 있고, 실제 generateText
 * 호출은 app/api/ai/promo/route.ts, app/api/ai/taunt/route.ts 안에서만 일어난다.
 */

export const AiService = {
  // 로비에서 "AI 홍보 문구 생성" 버튼을 누르면 호출된다.
  async fetchPromo(): Promise<string> {
    const res = await fetch('/api/ai/promo', { method: 'POST' });
    if (!res.ok) throw new Error(`promo API 응답 실패 (${res.status})`);
    const data = (await res.json()) as { text: string };
    return data.text;
  },

  // 게임 종료(GAMEOVER) 시 승리자에게 보여줄 축하/도발 멘트를 생성한다.
  async fetchWinnerLine(winnerNames: string[], score: number): Promise<string> {
    const res = await fetch('/api/ai/taunt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerNames, score }),
    });
    if (!res.ok) throw new Error(`taunt API 응답 실패 (${res.status})`);
    const data = (await res.json()) as { text: string };
    return data.text;
  },
};
