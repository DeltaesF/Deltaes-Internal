import Work from "./workContent";

export default function WorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Work>{children}</Work>;
}
