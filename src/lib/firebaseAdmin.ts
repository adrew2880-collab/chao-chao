// src/lib/firebaseAdmin.ts
// 서버(API 라우트) 전용 Firestore 쓰기 통로.
//
// 서비스 계정 자격 증명(FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)은
// NEXT_PUBLIC_ 접두어가 없는 "비공개" 서버 환경변수라 브라우저 번들에는 절대 포함되지 않고,
// Next.js API 라우트(app/api/**) 안에서만 읽힌다.
//
// 방 생성/참여/게임 시작/채팅/인게임 액션 등 모든 "쓰기"는 예외 없이 이 Admin SDK를 통해서만
// 이뤄진다. Firestore 보안 규칙은 다음과 같이 걸어둔다(콘솔 > Firestore > 규칙):
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /rooms/{roomId} {
//         allow read: if true;   // 방 목록/상태는 누구나 실시간으로 읽을 수 있다
//         allow write: if false; // 클라이언트의 직접 쓰기는 항상 거부 — 서버(Admin SDK)만 쓸 수 있다
//       }
//     }
//   }
//
// 즉 클라이언트가 이 규칙을 우회해서 Firestore에 직접 쓰기를 시도해도 항상 거부되고,
// 게임 규칙(gameReducer)은 언제나 서버에서만 실행된다.
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel/`.env` 파일에 개인키를 저장하면 실제 줄바꿈이 "\n" 두 글자로 이스케이프되는
  // 경우가 많다. PEM 형식으로 파싱되려면 그 이스케이프를 다시 진짜 개행으로 풀어줘야 한다.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase 서비스 계정 환경변수(FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)가 설정되지 않았습니다. .env.local과 Vercel 프로젝트 환경변수를 확인해 주세요.'
    );
  }

  adminApp = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return adminApp;
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
