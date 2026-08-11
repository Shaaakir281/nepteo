import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Requis pour l'image Docker (copie .next/standalone)
  output: "standalone",
  // Une copie Git peut vivre sous un autre dépôt local. Fixer explicitement la
  // racine empêche Next/Tailwind de parcourir les artefacts `.next` du parent.
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
};

export default nextConfig;
