import type { Metadata } from "next";

import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { getServerEnv } from "@/lib/env";

const { APP_NAME } = getServerEnv();

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "A lightweight, self-hosted trading ERP.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
