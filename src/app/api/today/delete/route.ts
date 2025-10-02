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
    const { docId, eventId } = await req.json();

    if (!docId || !eventId) {
      return NextResponse.json(
        { error: "Missing docId or eventId" },
        { status: 400 }
      );
    }

    await db
      .collection("today")
      .doc(docId)
      .collection("events")
      .doc(eventId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting event:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
