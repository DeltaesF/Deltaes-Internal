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
import { collection, query, where, getDocs } from "firebase/firestore";

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
  loading: boolean;
  error?: string | null;
};

interface AuthPayload {
  user: PlainUser | null;
  userDocId: string | null;
  userName: string | null;
  role: string | null;
}

const initialState: AuthState = {
  user: null,
  userDocId: null,
  userName: null,
  role: null,
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
    return {
      user: serializableUser,
      userDocId,
      userName: data.userName,
      role: data.role || null,
    };
  } else {
    return {
      user: serializableUser,
      userDocId: null,
      userName: null,
      role: null,
    };
  }
});

// ✅ 로그아웃
export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  await signOut(auth);
});

// ✅ 앱 초기화 시 인증 상태 확인
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

          if (!snap.empty) {
            const doc = snap.docs[0];
            const data = doc.data() as EmployeeDoc;
            resolve({
              user: serializableUser,
              userDocId: doc.id,
              userName: data.userName,
              role: data.role || null,
            });
          } else {
            resolve({
              user: serializableUser,
              userDocId: null,
              userName: null,
              role: null,
            });
          }
        } else {
          resolve({ user: null, userDocId: null, userName: null, role: null });
        }
        unsubscribe();
      });
    });
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // 필요하면 동기 액션을 추가할 수 있음
  },
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
      state.loading = false;
      state.error = null;
    });

    // initAuth
    builder.addCase(initAuth.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(initAuth.fulfilled, (state, action) => {
      // 여기도 마찬가지로 action.payload 타입이 명확해집니다.
      state.user = action.payload.user;
      state.userDocId = action.payload.userDocId;
      state.userName = action.payload.userName;
      state.role = action.payload.role;
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
