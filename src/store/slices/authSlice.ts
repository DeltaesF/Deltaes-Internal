// Redux Toolkit
// 액션 관리

// 로그인/로그아웃/초기화 로직을 포함

import { auth, db } from "@/lib/firebase";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { addDoc, collection, query, where, getDocs } from "firebase/firestore";

interface EmployeeDoc {
  email: string;
  userName: string;
  role?: string;
}

// Redux 상태에 저장될 사용자 정보 타입을 정의합니다. (직렬화 가능하도록)
interface PlainUser {
  uid: string;
  email: string | null;
}

// 전체 인증 상태의 타입을 정의합니다.
type AuthState = {
  user: PlainUser | null; // Firebase User 객체 대신 PlainUser 객체를 사용합니다.
  userDocId: string | null;
  userName: string | null;
  role: string | null;
  loginTime: string | null;
  loading: boolean;
  error?: string | null;
};

interface AuthPayload {
  user: PlainUser | null;
  userDocId: string | null;
  userName: string | null;
  role: string | null;
  loginTime: string | null;
}

const initialState: AuthState = {
  user: null,
  userDocId: null,
  userName: null,
  role: null,
  loginTime: null,
  loading: true,
  error: null,
};

// ✅ 로그인
// ✨ 변경점 2: createAsyncThunk에 반환 타입(AuthPayload)과 입력 인자 타입을 명시합니다.
export const loginUser = createAsyncThunk<
  AuthPayload,
  { email: string; password: string }
>("auth/loginUser", async ({ email, password }) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const now = new Date(); // 현재 시간
  const loginTimeStr = now.toLocaleString("ko-KR"); // 화면 표시용 문자열

  const q = query(collection(db, "employee"), where("email", "==", user.email));
  const snap = await getDocs(q);

  const serializableUser: PlainUser = {
    uid: user.uid,
    email: user.email,
  };

  if (!snap.empty) {
    const doc = snap.docs[0];
    const data = doc.data() as EmployeeDoc;
    const userDocId = doc.id;

    // ✅ [추가] 로그인 이력(Log) 저장 (employee/{id}/loginHistory 컬렉션)
    try {
      await addDoc(collection(db, "employee", userDocId, "loginHistory"), {
        loginAt: now,
        userAgent: window.navigator.userAgent, // 접속 기기 정보 (PC/Mobile 확인용)
        email: user.email,
      });
    } catch (e) {
      console.error("로그인 기록 저장 실패:", e);
    }

    return {
      user: serializableUser,
      userDocId,
      userName: data.userName,
      role: data.role || null,
      loginTime: loginTimeStr, // 리덕스에 저장
    };
  } else {
    return {
      user: serializableUser,
      userDocId: null,
      userName: null,
      role: null,
      loginTime: loginTimeStr,
    };
  }
});

// ✅ 로그아웃
export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  await signOut(auth);
});

// ✅ initAuth 수정 (새로고침 시 로그인 시간 유지)
// 주의: 새로고침 시에는 로그를 다시 쌓지 않고, Firebase Auth의 lastSignInTime을 사용하거나 현재 시간을 사용
export const initAuth = createAsyncThunk<AuthPayload, void>(
  "auth/initAuth",
  async () => {
    return new Promise<AuthPayload>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          const q = query(
            collection(db, "employee"),
            where("email", "==", user.email)
          );
          const snap = await getDocs(q);

          const serializableUser: PlainUser = {
            uid: user.uid,
            email: user.email,
          };

          // Firebase User 객체에 있는 마지막 로그인 시간 활용
          const lastSignInTime = user.metadata.lastSignInTime
            ? new Date(user.metadata.lastSignInTime).toLocaleString("ko-KR")
            : new Date().toLocaleString("ko-KR");

          if (!snap.empty) {
            const doc = snap.docs[0];
            const data = doc.data() as EmployeeDoc;
            resolve({
              user: serializableUser,
              userDocId: doc.id,
              userName: data.userName,
              role: data.role || null,
              loginTime: lastSignInTime, // 복구된 로그인 시간
            });
          } else {
            resolve({
              user: serializableUser,
              userDocId: null,
              userName: null,
              role: null,
              loginTime: lastSignInTime,
            });
          }
        } else {
          resolve({
            user: null,
            userDocId: null,
            userName: null,
            role: null,
            loginTime: null,
          });
        }
        unsubscribe();
      });
    });
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // loginUser
    builder.addCase(loginUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.userDocId = action.payload.userDocId;
      state.userName = action.payload.userName;
      state.role = action.payload.role;
      state.loginTime = action.payload.loginTime; // 저장
      state.loading = false;
      state.error = null;
    });
    builder.addCase(loginUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || "로그인 실패";
    });

    // logoutUser
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
      state.userDocId = null;
      state.userName = null;
      state.loginTime = null; // 초기화
      state.loading = false;
      state.error = null;
    });

    // initAuth
    builder.addCase(initAuth.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(initAuth.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.userDocId = action.payload.userDocId;
      state.userName = action.payload.userName;
      state.role = action.payload.role;
      state.loginTime = action.payload.loginTime; // 복구
      state.loading = false;
      state.error = null;
    });
    builder.addCase(initAuth.rejected, (state) => {
      state.loading = false;
      state.error = "초기 인증 실패";
    });
  },
});

export default authSlice.reducer;
