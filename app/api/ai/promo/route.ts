// app/api/ai/promo/route.ts
// 로비 화면의 "AI 홍보 문구 생성" 버튼이 호출하는 서버 라우트.
// AI_GATEWAY_API_KEY는 여기(서버)에서만 읽히고 브라우저로는 절대 전달되지 않는다.
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const { text } = await generateText({
      // 'openai/gpt-4o'처럼 "provider/model" 문자열을 넘기면 AI SDK가
      // AI_GATEWAY_API_KEY 환경변수를 보고 자동으로 Vercel AI Gateway를 거쳐 호출한다.
      model: 'openai/gpt-4o',
      prompt:
        '보드게임 챠오챠오에 대한 짧고 재미있는 홍보 문구를 한국어로 한 문장만 작성해 줘. 이모지 1~2개를 곁들여도 좋아.',
    });
    return NextResponse.json({ text });
  } catch (err) {
    // [보안] 에러 상세(원인에 키가 섞여 나올 수 있음)는 서버 로그에만 남기고, 클라이언트에는
    // 일반화된 메시지만 내려준다.
    console.error('[api/ai/promo] generateText 실패:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'AI 홍보 문구 생성에 실패했습니다.' }, { status: 500 });
  }
}
