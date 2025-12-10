import WeekMeeting from "./weekMeeting";

export default function Meetingayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WeekMeeting>{children}</WeekMeeting>;
}
