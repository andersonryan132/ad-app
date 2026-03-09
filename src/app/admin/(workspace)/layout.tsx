import AdminWorkspaceShell from "@/presentation/components/admin/AdminWorkspaceShell";

export default function AdminWorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminWorkspaceShell>{children}</AdminWorkspaceShell>;
}
