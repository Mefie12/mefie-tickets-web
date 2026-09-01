import type { Metadata } from "next";
import Script from "next/script";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import "@mantine/dropzone/styles.css";
import "@mantine/carousel/styles.css";
import { mantineHtmlProps } from "@mantine/core";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Mefie Tickets",
  description:
    "Multi-tenant SaaS event & ticketing platform — MVP in progress.",
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
