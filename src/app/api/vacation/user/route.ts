import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { getFirestore, DocumentReference } from "firebase-admin/firestore"; // ✅ DocumentReference 추가

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

// ✅ [수정] DB 문서 전체 구조를 나타내는 인터페이스 정의 (any 제거)
interface EmployeeData {
  joinDate?: string;
  usedVacation?: number;
  remainingVacation?: number;
  lastResetYear?: number;
  lastUpdateMonth?: number | null;
  // 필요하다면 다른 필드들도 여기에 추가 (예: userName, department 등)
  [key: string]: unknown; // 다른 필드가 있을 수 있으므로 unknown으로 허용 (any보다 안전)
}

// 📅 근속연수에 따른 연차 개수 계산
function calculateVacationDays(joinDateStr: string) {
  const joinDate = new Date(joinDateStr);
  const today = new Date();

  let yearsWorked = today.getFullYear() - joinDate.getFullYear();
  const m = today.getMonth() - joinDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < joinDate.getDate())) {
    yearsWorked--;
  }

  if (yearsWorked < 1) return 0;

  const extraDays = Math.floor((yearsWorked - 1) / 2);
  const totalDays = 15 + extraDays;

  return Math.min(25, totalDays);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userDocId = searchParams.get("userDocId");
  if (!userDocId)
    return NextResponse.json({ error: "userDocId 누락" }, { status: 400 });

  // ✅ [핵심 수정] docRef에 제네릭 타입 지정 -> update() 오류 해결
  const docRef = db
    .collection("employee")
    .doc(userDocId) as DocumentReference<EmployeeData>;
  const doc = await docRef.get();

  if (!doc.exists)
    return NextResponse.json({ error: "문서 없음" }, { status: 404 });

  const data = doc.data(); // 이제 data는 EmployeeData | undefined 타입이 됩니다.
  const joinDateStr = data?.joinDate;

  if (!joinDateStr) {
    return NextResponse.json({ ...data, error: "입사일(joinDate) 정보 없음" });
  }

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const joinDate = new Date(joinDateStr);

  const monthsWorked =
    (currentDate.getFullYear() - joinDate.getFullYear()) * 12 +
    (currentDate.getMonth() - joinDate.getMonth());

  // ✅ [수정] Partial<EmployeeData> 사용 (EmployeeData의 부분 집합)
  let updatedData: Partial<EmployeeData> = {};
  let needsUpdate = false;

  // ---------------------------------------------------------
  // [CASE 1] 1년 이상 근무자
  // ---------------------------------------------------------
  if (monthsWorked >= 12) {
    if (!data?.lastResetYear || data.lastResetYear < currentYear) {
      const newVacationDays = calculateVacationDays(joinDateStr);

      updatedData = {
        usedVacation: 0,
        remainingVacation: newVacationDays,
        lastResetYear: currentYear,
        lastUpdateMonth: null,
      };
      needsUpdate = true;
    }
  }
  // ---------------------------------------------------------
  // [CASE 2] 1년 미만 신입사원
  // ---------------------------------------------------------
  else {
    const lastUpdateMonth = data?.lastUpdateMonth || joinDate.getMonth() + 1;

    if (currentMonth > lastUpdateMonth) {
      let monthsToGive = currentMonth - lastUpdateMonth;

      if (currentMonth === 12) {
        monthsToGive += 1;
      }

      const currentRemaining = data?.remainingVacation || 0;

      if (currentRemaining < 12) {
        const newRemaining = Math.min(12, currentRemaining + monthsToGive);

        if (newRemaining > currentRemaining) {
          updatedData = {
            remainingVacation: newRemaining,
            lastUpdateMonth: currentMonth,
          };
          needsUpdate = true;
        }
      }
    }
  }

  if (needsUpdate) {
    // ✅ docRef가 Typed Reference이므로 updatedData가 Partial<EmployeeData> 타입이면 오류 없이 통과됨
    await docRef.update(updatedData);
    return NextResponse.json({ ...data, ...updatedData });
  }

  return NextResponse.json(data);
}
