import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

// Firebase Admin 초기화
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

// ✅ [Type] DB 데이터 구조 정의 (Any 오류 해결용)
interface EmployeeData {
  userName: string;
  email: string;
  department: string;
  role: string;
  order?: number; // 정렬용 (1, 2, 3...)
  joinDate?: string; // 정렬용 (YYYY-MM-DD)
  recipients?: {
    work?: string[];
    report?: string[];
    approval?: string[];
    vacation?: {
      first?: string[];
      second?: string[];
      third?: string[];
      shared?: string[];
    };
  };
}

// ✅ [Type] 업데이트 요청 바디 구조
interface UpdateBody {
  id: string;
  role: string;
  department: string;
  recipients?: EmployeeData["recipients"];
}

// 직원 목록 조회 (GET)
export async function GET() {
  try {
    // 1. 모든 데이터 가져오기 (정렬은 메모리에서 수행)
    const snapshot = await db.collection("employee").get();

    // 2. 타입 안전하게 매핑 (any 오류 해결)
    const employees = snapshot.docs.map((doc) => {
      const data = doc.data() as EmployeeData; // 명시적 타입 캐스팅
      return {
        id: doc.id,
        ...data,
      };
    });

    // ✅ [수정] 다중 정렬 (Order -> Department -> JoinDate)
    employees.sort((a, b) => {
      // 1순위: Order (직급 순서)
      const orderA = a.order ?? 9999;
      const orderB = b.order ?? 9999;
      if (orderA !== orderB) return orderA - orderB;

      // 2순위: Department (부서명) - 부서끼리 뭉쳐야 rowSpan 가능
      const deptA = a.department || "";
      const deptB = b.department || "";
      if (deptA < deptB) return -1;
      if (deptA > deptB) return 1;

      // 3순위: JoinDate (입사일)
      const dateA = a.joinDate || "9999-99-99";
      const dateB = b.joinDate || "9999-99-99";
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;

      return 0;
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// 직원 정보 수정 (POST)
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UpdateBody; // 타입 캐스팅
    const { id, role, department, recipients } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // 업데이트할 데이터 객체 생성
    const updateData: Record<string, unknown> = {
      role,
      department,
    };

    if (recipients) {
      updateData.recipients = recipients;
    }

    await db.collection("employee").doc(id).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating employee:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
