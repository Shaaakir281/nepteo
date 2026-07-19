import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nepteo — Cockpit Growth",
  description:
    "Copilote marketing IA : comprendre, décider et agir en quelques clics.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
