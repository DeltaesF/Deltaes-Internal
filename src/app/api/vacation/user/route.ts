import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userDocId = searchParams.get("userDocId");
  if (!userDocId)
    return NextResponse.json({ error: "userDocId 누락" }, { status: 400 });

  const doc = await db.collection("employee").doc(userDocId).get();
  if (!doc.exists)
    return NextResponse.json({ error: "문서 없음" }, { status: 404 });

  return NextResponse.json(doc.data());
}
