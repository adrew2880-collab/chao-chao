// app/api/ai/taunt/route.ts
// 게임 종료(승리) 화면이 호출하는 서버 라우트 — 승자에게 보여줄 짧은 축하/도발 멘트를 생성한다.
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  let winnerNames: unknown;
  let score: unknown;
  try {
    const body = await req.json();
    winnerNames = body.winnerNames;
    score = body.score;
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const names = Array.isArray(winnerNames) && winnerNames.length ? winnerNames.join(', ') : '플레이어';
  const scoreNum = typeof score === 'number' ? score : 0;

  try {
    const { text } = await generateText({
      model: 'openai/gpt-4o',
      prompt:
        `보드게임 챠오챠오에서 "${names}"가(이) ${scoreNum}점으로 우승했어. ` +
        '우승자에게 짧고 유쾌하게, 장난스러운 도발을 살짝 섞어서 축하하는 말을 한국어로 한 문장만 작성해 줘.',
    });
    return NextResponse.json({ text });
  } catch (err) {
    console.error('[api/ai/taunt] generateText 실패:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'AI 축하 멘트 생성에 실패했습니다.' }, { status: 500 });
  }
}
