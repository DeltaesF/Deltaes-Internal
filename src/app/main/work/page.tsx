import { redirect } from "next/navigation";

export default function WorkPage() {
  // /main/work 접속 시 -> /main/work/daily 로 리다이렉트
  redirect("/main/work/daily");
}
