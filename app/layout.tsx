import "./globals.css";
import { Chakra_Petch, Nanum_Gothic } from "next/font/google";

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-chakra",
});

const nanum = Nanum_Gothic({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-nanum",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        className={`${chakra.variable} ${nanum.variable}`}
        style={{
          fontFamily:
            "var(--font-chakra), var(--font-nanum), system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}

export { chakra };
