// src/lib/firebaseClient.ts
// 브라우저에서 Firestore를 "실시간 구독(onSnapshot)"하기 위한 클라이언트 SDK 초기화.
//
// 여기 쓰이는 NEXT_PUBLIC_FIREBASE_* 환경변수들은 Firebase 설계상 "공개" 설정값이라
// 브라우저 번들에 그대로 노출되어도 안전하다 — 실제 접근 제어는 이 키가 아니라
// Firestore 보안 규칙(firestore.rules)이 담당한다. 이 클라이언트로는 절대 방/게임
// 상태를 직접 쓰지 않는다 — 오직 onSnapshot 구독(읽기)에만 사용한다.
//
// [중요] Next.js는 `process.env.NEXT_PUBLIC_XXX` 처럼 "정적으로 완전히 써 있는" 접근만
// 빌드 시점에 실제 값으로 치환(inline)한다. `process.env[someVariable]`처럼 동적으로
// 접근하면 브라우저에서는 항상 undefined가 된다 — 그래서 아래에서도 각 변수를 반드시
// 리터럴로 하나씩 읽는다(반복문으로 순회하지 않는 이유).
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

const missingKeys: string[] = [];
if (!apiKey) missingKeys.push('NEXT_PUBLIC_FIREBASE_API_KEY');
if (!authDomain) missingKeys.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
if (!projectId) missingKeys.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
if (!appId) missingKeys.push('NEXT_PUBLIC_FIREBASE_APP_ID');

let _db: Firestore | null = null;
let _initError: string | null = null;

if (missingKeys.length > 0) {
  // 흔한 원인 두 가지:
  //  1) Vercel 프로젝트 설정의 환경변수가 "Production" 환경에 체크되어 있지 않음
  //  2) 환경변수를 추가/수정한 뒤 재배포(Redeploy)를 하지 않음 — NEXT_PUBLIC_* 값은
  //     "빌드 시점"에 번들에 박히므로, 나중에 값만 추가해도 이미 만들어진 빌드에는
  //     소급 적용되지 않는다. 반드시 재배포해야 새 값이 반영된다.
  _initError = `Firebase 클라이언트 설정값이 비어 있습니다: ${missingKeys.join(', ')}. Vercel 프로젝트 설정 > Environment Variables에서 값이 "Production" 환경에 등록되어 있는지, 등록/수정 후 재배포(Redeploy)를 했는지 확인해 주세요.`;
  // eslint-disable-next-line no-console
  console.error('[firebaseClient] Firebase 초기화 실패:', _initError);
} else {
  try {
    const firebaseConfig: FirebaseOptions = { apiKey, authDomain, projectId, appId };
    // Next.js는 HMR/여러 모듈 인스턴스로 initializeApp이 중복 호출될 수 있으므로,
    // 이미 초기화된 앱이 있으면 그걸 재사용한다.
    const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
    _db = getFirestore(app);
  } catch (err) {
    _initError = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[firebaseClient] Firebase 초기화 중 예외 발생:', _initError);
  }
}

// db가 없을 때(_db===null) 이걸 그냥 export해서 컴포넌트/훅이 즉시 예외로 죽어버리면
// 모바일에서 "버튼을 눌러도 화면이 아예 반응하지 않는" 것처럼 보일 수 있다(리액트
// 하이드레이션 자체가 실패하기 때문). 그래서 db는 함수로 감싸서 내보내고, 호출부가
// null을 직접 확인한 뒤 화면에 에러 메시지를 보여주도록 한다 — useRoomsList/useRoomDoc
// 참고.
export function getDb(): Firestore | null {
  return _db;
}

export function getFirebaseInitError(): string | null {
  return _initError;
}
