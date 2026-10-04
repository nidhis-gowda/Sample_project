import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/hooks/useToast";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "SkillAlloc";

export const metadata: Metadata = {
  title: {
    default: `${appName} — Employee Skill & Project Allocation`,
    template: `%s · ${appName}`,
  },
  description:
    "Manage employees, skills, projects and workloads, and get transparent, explainable employee recommendations for every project.",
  applicationName: appName,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}