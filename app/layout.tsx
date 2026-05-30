import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Employment Dispute Reality Check",
  description: "Hackathon MVP for simulating UK Employment Tribunal outcomes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
