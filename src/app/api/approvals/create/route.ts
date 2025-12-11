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

export async function POST(req: Request) {
  try {
    const { userName, title, content, fileUrl, fileName } = await req.json();

    if (!userName || !title || !content)
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );

    const docRef = db
      .collection("approvals")
      .doc(userName)
      .collection("userApprovals")
      .doc();

    await docRef.set({
      title,
      content,
      userName,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
