import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
    const { id } = await req.json();

    const snapshot = await db.collectionGroup("userApprovals").get();
    const doc = snapshot.docs.find((d) => d.id === id);

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const d = doc.data();

    // 데이터 전체 반환
    const data = {
      id: doc.id,
      ...d,
      createdAt:
        d.createdAt && typeof d.createdAt.toMillis === "function"
          ? d.createdAt.toMillis()
          : d.createdAt || Date.now(),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
