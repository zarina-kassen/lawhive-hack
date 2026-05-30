import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tribunal Navigator",
  description: "Simulate UK Employment Tribunal outcomes and turn them into practical next steps.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
