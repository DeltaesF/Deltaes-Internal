// Redux store 설정 파일
// 앱 전체에서 Provider로 감싸서 사용됨.

import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
// store 생성
export const store = configureStore({
  reducer: {
    // 상태관리 담당하는 slice 등록
    auth: authReducer, // 로그인/유저 상태 담당 slice
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
