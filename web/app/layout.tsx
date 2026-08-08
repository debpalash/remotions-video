import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kino Studio — agency-grade video, no slop",
  description:
    "Paste a URL → approve the outline → approve the storyboard → render. Your actual product, rendered deterministically.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
