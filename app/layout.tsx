import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: "Git/City",
      template: "%s · Git/City",
    },
    description:
      "Explore popular open source organizations as living 3D skylines shaped by code activity, community, and momentum.",
    applicationName: "Git/City",
    keywords: [
      "GitHub",
      "data visualization",
      "3D city",
      "repository analytics",
      "developer tools",
    ],
    openGraph: {
      type: "website",
      title: "Git/City — Repositories become a living skyline",
      description:
        "Explore popular open source organizations as cinematic interactive 3D cities.",
      url: metadataBase,
      siteName: "Git/City",
      images: [
        {
          url: new URL("/og.png", metadataBase),
          width: 1729,
          height: 910,
          alt: "Git/City — repositories become a living skyline",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Git/City — Repositories become a living skyline",
      description:
        "Explore popular open source organizations as cinematic interactive 3D cities.",
      images: [new URL("/og.png", metadataBase)],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#02060c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
