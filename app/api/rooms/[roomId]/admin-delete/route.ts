// app/api/rooms/[roomId]/admin-delete/route.ts
// 로비 방 목록의 "⋮ → 방 삭제(관리자)" 메뉴에서 호출된다. 접속이 끊기거나 비정상
// 종료된 뒤 이탈 감지(leave)나 하트비트 만료로도 정리되지 못했거나, 10분 자동
// 청소(cleanup)를 기다리고 싶지 않을 때 사람이 즉시 수동으로 지우는 비상 도구다.
//
// 비밀번호는 반드시 서버(여기)에서만 검사한다. 클라이언트에서만 "0429"와 비교하고
// 통과하면 무조건 삭제 API를 부르는 식으로 짜면, 그 비교 로직 자체가 브라우저
// 번들에 그대로 노출돼서 검증이 있으나 마나 하게 된다 — 그래서 비밀번호 문자열도
// 이 서버 파일 안에만 두고 어떤 클라이언트 컴포넌트에서도 import하지 않는다.
//
// [솔직한 한계] 그렇다고 이게 "진짜" 보안은 아니다 — 이 코드 자체가 공개 저장소에
// 커밋되므로 숫자 4자리는 사실상 공공연한 값이다. 아무나 남의 방을 실수로/장난으로
// 못 지우게 막는 가벼운 방지책 정도로만 취급해야 하며, 정말 안전하게 막으려면
// 로그인/세션 기반 인증으로 교체해야 한다.
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

const ADMIN_DELETE_PASSWORD = '0429';

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.password !== ADMIN_DELETE_PASSWORD) {
      return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 });
    }
    // 존재하지 않는 문서에 대한 delete()는 에러 없이 조용히 성공 처리된다(멱등) —
    // 이미 다른 경로(청소/이탈 처리)로 지워진 방을 다시 지우려 해도 문제없다.
    await getAdminDb().collection('rooms').doc(roomId).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/rooms/admin-delete] 삭제 실패:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: '방 삭제에 실패했습니다.' }, { status: 500 });
  }
}
