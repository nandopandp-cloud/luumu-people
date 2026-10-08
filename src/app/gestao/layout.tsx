import { ManagementShell } from "@/features/shell/app-shell";

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return <ManagementShell>{children}</ManagementShell>;
}
