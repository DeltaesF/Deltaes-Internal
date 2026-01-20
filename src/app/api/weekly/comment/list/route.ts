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
    const { weeklyId, authorUserName } = await req.json();

    if (!weeklyId || !authorUserName) return NextResponse.json({ list: [] });

    const snapshot = await db
      .collection("weekly")
      .doc(authorUserName)
      .collection("userWeeklys")
      .doc(weeklyId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .get();

    const list = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userName: data.userName,
        content: data.content,
        createdAt:
          data.createdAt && typeof data.createdAt.toMillis === "function"
            ? data.createdAt.toMillis()
            : data.createdAt || Date.now(),
      };
    });

    return NextResponse.json({ list });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
