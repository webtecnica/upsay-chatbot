import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UpSay - Assistente Virtual",
  description: "Assistente inteligente da plataforma UpSay. Tire suas dúvidas sobre multi-atendimento WhatsApp e omnichannel.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
