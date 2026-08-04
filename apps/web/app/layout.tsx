import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Think Tank Solutions AI — B.i.a.B",
  description: "Intelligence, precisely applied. Results, rigorously measured.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#0A2540",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className="bg-[#FAF9F7] text-[#36454F]"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
