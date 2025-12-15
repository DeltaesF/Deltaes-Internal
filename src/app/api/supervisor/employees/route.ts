import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

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

interface EmployeeUpdatePayload {
  role: string;
  department: string;
  recipients?: {
    work?: string[];
    report?: string[];
    approval?: string[];
  };
}

// 직원 목록 조회
export async function GET() {
  try {
    const snapshot = await db.collection("employee").orderBy("userName").get();
    const employees = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

// 직원 권한/부서 수정
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, role, department, recipients } = body;

    if (!id) return NextResponse.json({ error: "ID Missing" }, { status: 400 });

    // 업데이트할 데이터 구성
    const updateData: Partial<EmployeeUpdatePayload> = {
      role,
      department,
    };

    // 수신자 설정이 있는 경우에만 업데이트 (기존 데이터 유지 위해)
    if (recipients) {
      updateData.recipients = recipients;
    }

    await db.collection("employee").doc(id).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating employee:", error);
    return NextResponse.json({ error: "Update Failed" }, { status: 500 });
  }
}
