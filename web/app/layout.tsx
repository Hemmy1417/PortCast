import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Big_Shoulders, Fragment_Mono } from "next/font/google";

import { Shell } from "@/components/Shell";
import { WalletProvider } from "@/lib/wallet";

import "./globals.css";

const shoulders = Big_Shoulders({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-shoulders", display: "swap" });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson", display: "swap" });
const fragment = Fragment_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-fragment", display: "swap" });

export const metadata: Metadata = {
  title: "PortCast",
  description:
    "Prediction markets on port, canal, route and weather disruptions, with criteria frozen before "
    + "trading and every answer resolved by GenLayer validators from recorded public reporting.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${shoulders.variable} ${atkinson.variable} ${fragment.variable}`}>
      <body>
        <WalletProvider>
          <Shell>{children}</Shell>
        </WalletProvider>
      </body>
    </html>
  );
}
