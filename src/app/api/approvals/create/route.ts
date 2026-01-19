import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

// ✅ [추가] 품의서 데이터 타입 정의
interface ApprovalData {
  approvalType: string; // 'purchase'(기본), 'vehicle', 'business_trip_request' 등
  title: string;
  content: string;
  userName: string;
  department: string; // 부서 정보 추가
  approvers: {
    first: string[];
    second: string[];
    third: string[];
    shared: string[];
  };
  status: string;
  createdAt: FieldValue;
  // 🔹 차량/외근용 선택 필드
  contact?: string | null;
  isExternalWork?: boolean;
  isVehicleUse?: boolean;
  implementDate?: string | null;
  vehicleModel?: string | null;
  usagePeriod?: string | null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userName,
      title,
      content,
      approvalType = "purchase", // 기본값은 구매 품의서
      // 차량용 필드
      contact,
      isExternalWork,
      isVehicleUse,
      implementDate,
      vehicleModel,
      usagePeriod,
    } = body;

    if (!userName || !title || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. 직원 정보(결재선) 조회
    const employeeQuery = await db
      .collection("employee")
      .where("userName", "==", userName)
      .get();
    let approvalLine = { first: [], second: [], third: [], shared: [] };
    let department = "";

    if (!employeeQuery.empty) {
      const empData = employeeQuery.docs[0].data();
      // 결재선 정보 가져오기 (approval 라인 사용)
      approvalLine = empData.recipients?.approval || approvalLine;
      department = empData.department || "";
    }

    // 2. 저장할 데이터 구성
    const docData: ApprovalData = {
      approvalType,
      title,
      content,
      userName,
      department,
      approvers: approvalLine,
      status: "1차 결재 대기",
      createdAt: FieldValue.serverTimestamp(),
    };

    // 타입별 필드 추가
    if (approvalType === "vehicle") {
      docData.contact = contact || null;
      docData.isExternalWork = isExternalWork || false;
      docData.isVehicleUse = isVehicleUse || false;
      docData.implementDate = implementDate || null;
      docData.vehicleModel = vehicleModel || null;
      docData.usagePeriod = usagePeriod || null;
    }

    // 3. DB 저장 (approvals 컬렉션)
    const docRef = db
      .collection("approvals")
      .doc(userName)
      .collection("userApprovals")
      .doc();

    await docRef.set(docData);

    // 4. 알림 발송 (기존 로직 유지 + 링크 수정)
    const batch = db.batch();
    const firstApprovers: string[] = approvalLine.first || [];

    firstApprovers.forEach((approver) => {
      const notiRef = db
        .collection("notifications")
        .doc(approver)
        .collection("userNotifications")
        .doc();
      batch.set(notiRef, {
        targetUserName: approver,
        fromUserName: userName,
        type: "approval",
        message: `${title}_${userName} 결재 요청이 도착했습니다.`,
        link: `/main/my-approval/pending`,
        isRead: false,
        createdAt: Date.now(),
        approvalId: docRef.id, // ID 필드명 통일
      });
    });

    // 참조자 알림
    const referenceUsers = [
      ...(approvalLine.second || []),
      ...(approvalLine.third || []),
      ...(approvalLine.shared || []),
    ];
    const uniqueRefs = [...new Set(referenceUsers)] as string[];

    uniqueRefs.forEach((targetName: string) => {
      if (firstApprovers.includes(targetName)) return;
      const notiRef = db
        .collection("notifications")
        .doc(targetName)
        .collection("userNotifications")
        .doc();
      batch.set(notiRef, {
        targetUserName: targetName,
        fromUserName: userName,
        type: "approval",
        message: `[공유/예정] ${title}_${userName} 결재 요청이 도착했습니다.`,
        // 상세 페이지 링크 (타입에 따라 다를 수 있음. 일단 통합 상세 페이지로 가정)
        link: `/main/workoutside/approvals/${docRef.id}`,
        isRead: false,
        createdAt: Date.now(),
        approvalId: docRef.id,
      });
    });

    await batch.commit();

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
