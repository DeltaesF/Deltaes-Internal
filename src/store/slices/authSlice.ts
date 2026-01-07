import { auth, db } from "@/lib/firebase";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";

interface EmployeeDoc {
  email: string;
  userName: string;
  role?: string;
}

interface PlainUser {
  uid: string;
  email: string | null;
}

// ✅ AuthState 정의
type AuthState = {
  user: PlainUser | null;
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

// 🕒 헬퍼: 오늘 자정(00:00:00) 시간 구하기
const getTodayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// ✅ 1. 로그인 액션 (수정됨: 조회 먼저 -> 저장 나중에)
export const loginUser = createAsyncThunk<
  AuthPayload,
  { email: string; password: string }
>("auth/loginUser", async ({ email, password }) => {
  // 1. Firebase Auth 로그인
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const now = new Date();

  // 2. Firestore에서 직원 정보 조회
  const q = query(collection(db, "employee"), where("email", "==", user.email));
  const snap = await getDocs(q);

  const serializableUser: PlainUser = { uid: user.uid, email: user.email };

  // [CASE 1] DB에 직원 정보가 있는 경우
  if (!snap.empty) {
    const doc = snap.docs[0];
    const data = doc.data() as EmployeeDoc;
    const userDocId = doc.id;

    console.log("✅ [로그인 성공] 사용자:", data.userName);

    const historyRef = collection(db, "employee", userDocId, "loginHistory");
    const todayStart = getTodayStart();

    // ---------------------------------------------------------
    // 🔍 [1] 오늘 이미 로그인한 기록이 있는지 먼저 확인 (최초 시간 확보)
    // ---------------------------------------------------------
    let firstLoginTimeStr = now.toLocaleString("ko-KR"); // 기본값: 지금

    try {
      const qFirst = query(
        historyRef,
        where("loginAt", ">=", todayStart), // 오늘 0시 이후 기록
        orderBy("loginAt", "asc"), // 가장 옛날 것부터
        limit(1)
      );
      const firstSnap = await getDocs(qFirst);

      if (!firstSnap.empty) {
        // 이미 오늘 로그인한 기록이 있다면 -> 그 시간을 가져옴 (고정)
        const firstData = firstSnap.docs[0].data();
        const firstDate =
          firstData.loginAt instanceof Timestamp
            ? firstData.loginAt.toDate()
            : new Date(firstData.loginAt);
        firstLoginTimeStr = firstDate.toLocaleString("ko-KR");
        console.log("🕒 기존 로그인 기록 발견: ", firstLoginTimeStr);
      } else {
        console.log("🕒 오늘의 최초 로그인입니다.");
        // 기록이 없다면 -> 지금(now)이 최초 시간임
      }
    } catch (e) {
      console.warn("⚠️ 로그인 기록 조회 실패:", e);
    }

    // ---------------------------------------------------------
    // 📝 [2] 이번 로그인 로그 저장 (무조건 저장)
    // ---------------------------------------------------------
    try {
      await addDoc(historyRef, {
        loginAt: now,
        userAgent: window.navigator.userAgent,
        email: user.email,
        type: "login",
      });
    } catch (e) {
      console.error("❌ 로그인 로그 저장 실패:", e);
    }

    return {
      user: serializableUser,
      userDocId,
      userName: data.userName,
      role: data.role || null,
      loginTime: firstLoginTimeStr, // ✅ 고정된 최초 시간 반환
    };
  }
  // [CASE 2] DB 정보 없음
  else {
    return {
      user: serializableUser,
      userDocId: null,
      userName: user.displayName || "사용자(DB미등록)",
      role: null,
      loginTime: now.toLocaleString("ko-KR"),
    };
  }
});

// ✅ 2. 로그아웃
export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  await signOut(auth);
});

// ✅ 3. 앱 초기화 (새로고침/재접속 시 자동 로그아웃 체크 포함)
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
          const serializableUser = { uid: user.uid, email: user.email };

          if (!snap.empty) {
            const doc = snap.docs[0];
            const data = doc.data() as EmployeeDoc;
            const userDocId = doc.id;

            // ---------------------------------------------------------
            // 🚨 [자정 경과 체크] 오늘 날짜 기록이 없으면 -> 로그아웃
            // ---------------------------------------------------------
            const todayStart = getTodayStart();
            const historyRef = collection(
              db,
              "employee",
              userDocId,
              "loginHistory"
            );
            const qToday = query(
              historyRef,
              where("loginAt", ">=", todayStart),
              orderBy("loginAt", "asc"),
              limit(1)
            );

            try {
              const historySnap = await getDocs(qToday);

              if (historySnap.empty) {
                // ❌ 오늘 기록 없음 (어제 로그인한 세션) -> 로그아웃 처리
                console.warn("🚫 날짜가 변경되어 자동 로그아웃됩니다.");
                await signOut(auth);
                resolve({
                  user: null,
                  userDocId: null,
                  userName: null,
                  role: null,
                  loginTime: null,
                });
                return;
              }

              // ⭕ 오늘 기록 있음 -> 최초 시간 복구
              const firstData = historySnap.docs[0].data();
              const firstDate =
                firstData.loginAt instanceof Timestamp
                  ? firstData.loginAt.toDate()
                  : new Date(firstData.loginAt);

              resolve({
                user: serializableUser,
                userDocId,
                userName: data.userName,
                role: data.role || null,
                loginTime: firstDate.toLocaleString("ko-KR"),
              });
            } catch (e) {
              console.error("❌ 초기화 중 로그 조회 실패:", e);
              // 에러 시에도 일단 세션 유지
              resolve({
                user: serializableUser,
                userDocId,
                userName: data.userName,
                role: data.role || null,
                loginTime: new Date().toLocaleString("ko-KR"),
              });
            }
          } else {
            // DB 정보 없음 -> 세션 유지 (Auth Time 사용)
            const lastTime = user.metadata.lastSignInTime
              ? new Date(user.metadata.lastSignInTime).toLocaleString("ko-KR")
              : new Date().toLocaleString("ko-KR");
            resolve({
              user: serializableUser,
              userDocId: null,
              userName: "사용자(DB미등록)",
              role: null,
              loginTime: lastTime,
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
      state.loginTime = action.payload.loginTime;
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
      state.loginTime = null;
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
      state.loginTime = action.payload.loginTime;
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
