// src/lib/firebaseClient.ts
// 브라우저에서 Firestore를 "실시간 구독(onSnapshot)"하기 위한 클라이언트 SDK 초기화.
//
// 여기 쓰이는 NEXT_PUBLIC_FIREBASE_* 환경변수들은 Firebase 설계상 "공개" 설정값이라
// 브라우저 번들에 그대로 노출되어도 안전하다 — 실제 접근 제어는 이 키가 아니라
// Firestore 보안 규칙(firestore.rules)이 담당한다. 이 프로젝트의 규칙은 "읽기는 누구나
// 허용, 쓰기는 전부 거부"이므로(아래 firebaseAdmin.ts 주석 참고), 이 클라이언트로는
// 절대 방/게임 상태를 직접 쓰지 않는다 — 오직 onSnapshot 구독(읽기)에만 사용한다.
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Next.js는 HMR/여러 모듈 인스턴스로 initializeApp이 중복 호출될 수 있으므로,
// 이미 초기화된 앱이 있으면 그걸 재사용한다.
const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const db = getFirestore(app);
