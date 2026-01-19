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

interface UpdatePayload {
  title: string;
  content: string;
  updatedAt: FieldValue;
  // 외근/차량
  contact?: string;
  isExternalWork?: boolean;
  isVehicleUse?: boolean;
  implementDate?: string;
  vehicleModel?: string;
  usagePeriod?: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      userName,
      title,
      content,
      // 차량용
      contact,
      isExternalWork,
      isVehicleUse,
      implementDate,
      vehicleModel,
      usagePeriod,
    } = body;

    if (!id || !userName || !title)
      return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });

    const docRef = db
      .collection("approvals")
      .doc(userName)
      .collection("userApprovals")
      .doc(id);
    const doc = await docRef.get();

    if (!doc.exists)
      return NextResponse.json({ error: "문서 없음" }, { status: 404 });
    if (doc.data()?.userName !== userName)
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });

    const updateData: UpdatePayload = {
      title,
      content,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 차량 정보 업데이트
    if (contact !== undefined) updateData.contact = contact;
    if (isExternalWork !== undefined)
      updateData.isExternalWork = isExternalWork;
    if (isVehicleUse !== undefined) updateData.isVehicleUse = isVehicleUse;
    if (implementDate !== undefined) updateData.implementDate = implementDate;
    if (vehicleModel !== undefined) updateData.vehicleModel = vehicleModel;
    if (usagePeriod !== undefined) updateData.usagePeriod = usagePeriod;

    await docRef.update({ ...updateData });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval Update Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
