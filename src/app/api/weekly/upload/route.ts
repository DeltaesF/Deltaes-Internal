import { google } from "googleapis";
import { NextResponse } from "next/server";
import { Readable } from "stream";

// 1. 구글 API 에러 구조를 위한 타입 정의
type GoogleDriveError = {
  response?: {
    data?: {
      error?: {
        message?: string;
      };
    };
  };
  message?: string;
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    // Google Auth 설정
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(
          /\\n/g,
          "\n"
        ),
      },
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const drive = google.drive({ version: "v3", auth });

    // 파일 Buffer 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Stream 생성
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Google Drive 업로드
    const response = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [process.env.GOOGLE_DRIVE_WEEKLY_FOLDER_ID!],
      },
      media: {
        mimeType: file.type,
        body: stream,
      },
      supportsAllDrives: true,
      fields: "id",
    });

    const fileId = response.data.id;

    if (!fileId) {
      throw new Error("Google Drive API가 ID를 반환하지 않았습니다.");
    }

    // 권한 설정
    await drive.permissions.create({
      fileId: fileId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });

    const fileUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return NextResponse.json({ fileUrl });
  } catch (error: unknown) {
    // 2. error 타입을 unknown으로 변경
    console.error("Upload API Error Detail:", error);

    // 3. 에러를 위에서 정의한 타입으로 단언(Type Assertion)
    const err = error as GoogleDriveError;

    const errorMessage =
      err.response?.data?.error?.message || err.message || String(error);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
