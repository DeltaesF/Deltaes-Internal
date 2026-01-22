// src/app/api/approvals/list/route.ts

import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Query } from "firebase-admin/firestore";

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // 🔴 수정 전: const { page = 1, limit = 12, reportType, approvalType } = body;
    // ✅ 수정 후: approvalType 하나만 받음
    const { page = 1, limit = 12, approvalType } = body;

    let query: Query = db.collectionGroup("userApprovals");

    // ✅ 필터링 조건도 approvalType 하나만 사용
    if (approvalType) {
      query = query.where("approvalType", "==", approvalType);
    }

    // (이하 로직 동일)
    query = query.orderBy("createdAt", "desc");

    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit).offset(offset).get();

    const list = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title,
        userName: d.userName,
        department: d.department,
        status: d.status,
        approvalType: d.approvalType,
        createdAt:
          d.createdAt && typeof d.createdAt.toMillis === "function"
            ? d.createdAt.toMillis()
            : d.createdAt || Date.now(),

        serialNumber: d.serialNumber || "-",
        customerName: d.customerName || "-",
        product: d.product || "-",
      };
    });

    return NextResponse.json({ list, totalCount });
  } catch (error) {
    console.error("Error fetching approval list:", error);
    return NextResponse.json({ list: [], totalCount: 0 });
  }
}
