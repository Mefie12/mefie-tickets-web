import type { Metadata } from "next";
import Script from "next/script";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import "@mantine/dropzone/styles.css";
import "@mantine/carousel/styles.css";
import { mantineHtmlProps } from "@mantine/core";
import "./globals.css";
import { APP_URL } from "@/lib/backend";
import { Providers } from "./providers";

const DESCRIPTION = "Discover concerts, parties, talks and festivals — and get your tickets on Mefie Tickets.";

export const metadata: Metadata = {
  // Lets pages set relative openGraph/twitter image paths and canonical
  // URLs; also silences Next's "metadataBase not set" warning.
  metadataBase: new URL(APP_URL),
  title: "Mefie Tickets",
  description: DESCRIPTION,
  openGraph: {
    siteName: "Mefie Tickets",
    type: "website",
    title: "Mefie Tickets",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "Mefie Tickets", description: DESCRIPTION },
};

const colorSchemeScript = `try{var value=localStorage.getItem("mantine-color-scheme-value");var scheme=value==="light"||value==="dark"?value:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-mantine-color-scheme",scheme)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <Script id="mantine-color-scheme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: colorSchemeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
