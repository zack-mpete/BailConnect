import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth-client";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeaseHub RDC - Location immobilière",
  description: "Plateforme Next.js pour publier, chercher et signer des contrats de bail numériques.",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
