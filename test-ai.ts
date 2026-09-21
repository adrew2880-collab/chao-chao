// test-ai.ts — Vercel AI Gateway + AI SDK smoke test
//
// 이 파일은 Vercel AI Gateway가 올바르게 연결되어 있는지 확인하기 위한
// 최소한의 예제 스크립트입니다. .env.local 에 저장된 AI_GATEWAY_API_KEY 를
// 읽어와 AI SDK의 generateText()가 게이트웨이를 거쳐 실제 모델 응답을
// 받아오는지 검증합니다.
//
// 실행: npx tsx test-ai.ts  (또는 npm run test:ai)

import { config } from 'dotenv';
config({ path: '.env.local' }); // .env.local 을 명시적으로 로드 (dotenv 기본값은 .env 라서 별도 지정 필요)

import { generateText } from 'ai';

async function main() {
  // [보안] 키 값 자체는 절대 로그로 출력하지 않는다 — 존재 여부만 확인한다.
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY가 설정되어 있지 않습니다. .env.local 파일을 확인하세요.');
  }

  console.log('AI Gateway로 요청을 보내는 중...');

  const { text } = await generateText({
    // AI SDK는 "provider/model" 형식의 문자열을 넘기면, 별도 provider 설정 없이도
    // AI_GATEWAY_API_KEY 환경변수를 이용해 자동으로 Vercel AI Gateway를 거쳐 호출한다.
    model: 'openai/gpt-4o',
    prompt: '보드게임 챠오챠오에 대한 짧고 재미있는 홍보 문구를 작성해 줘',
  });

  console.log('\n--- AI Gateway 응답 ---');
  console.log(text);
  console.log('-----------------------\n');
  console.log('✅ 성공: AI Gateway를 통해 텍스트 응답을 정상적으로 받았습니다.');
}

main().catch((err) => {
  console.error('❌ 실패: AI Gateway 호출 중 오류가 발생했습니다.');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
