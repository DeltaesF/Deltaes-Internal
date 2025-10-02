// src/app/api/today/add/route.ts
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { docId, title, start, end } = body;

    if (!docId || !title || !start || !end) {
      return NextResponse.json(
        { error: "Missing fields (docId/title/start/end)" },
        { status: 400 }
      );
    }

    // today/{docId}/events 에 문서 추가
    const eventsRef = db.collection("today").doc(docId).collection("events");
    const docRef = await eventsRef.add({
      title,
      start,
      end,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: docRef.id, title, start, end });
  } catch (err) {
    console.error("Error in /api/today/add:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
