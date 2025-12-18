import {
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "./firebase";

export const login = async (email: string, password: string) => {
  await setPersistence(auth, browserSessionPersistence); // 세션 설정 창 닫으면 꺼짐
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logOut = async () => {
  return await signOut(auth);
};
