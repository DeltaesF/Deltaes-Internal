"use client";

import { useState } from "react";

export default function WeekMeeting({
  defaultTab = "week",
}: {
  defaultTab?: "week" | "business";
}) {
  const [activeTab, setActiveTab] = useState<
    "week" | "business" | "reportWrite" | "weeklyWrite"
  >(defaultTab);
  return (
    <div>
      <div>주간업무회의 페이지입니다.</div>
    </div>
  );
}
