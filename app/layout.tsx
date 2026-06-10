import type { Metadata } from "next";
import "@/styles/globals.scss";
import "@/styles/search.scss";
import { AuthProvider } from "@/context/AuthContext";

import { staticMetadata } from "./metadata";
export { viewport } from "./metadata";
import Columns from "@/components/layout/main";

export const metadata: Metadata = staticMetadata;


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" 
        />
      </head>
      <body>
          <AuthProvider>
            <Columns children={children}/>
          </AuthProvider>
      </body>
    </html>
  );
}
