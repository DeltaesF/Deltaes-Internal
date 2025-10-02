// src/app/api/today/list/route.ts
import { NextResponse } from "next/server";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    } as admin.ServiceAccount),
  });
}

const db = admin.firestore();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId"); // 클라이언트에서 docId(예: "홍성원 프로") 전달

    if (!docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    // today/{docId}/events 서브컬렉션에서 문서들 조회
    const snapshot = await db
      .collection("today")
      .doc(docId)
      .collection("events")
      .get();

    const events = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        start: data.start,
        end: data.end,
        createdAt: data.createdAt ? data.createdAt.toDate?.() : null,
      };
    });

    return NextResponse.json(events);
  } catch (err) {
    console.error("Error in /api/today/list:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
