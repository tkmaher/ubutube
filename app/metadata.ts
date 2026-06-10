import { Metadata } from "next";

export const staticMetadata: Metadata = {
    metadataBase: new URL("https://ubutube.org/"),
    applicationName: "UbuTube",
    title: {
      template: 'UbuTube | %s',
      default: 'UbuTube',
    },
    description: "UbuTube, an archive of UbuWeb.",
    keywords: ["film", "experimental", "archive", "independent", "video"],
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
      googleBot: "index, follow"
    },
    openGraph: {
      locale: "en_US",
      siteName: "UbuTube",
      url: "https://ubutube.org/",
      type: "website",
      images: [
        {
          url: "https://ubutube.org/spirale.png",
          width: 1200,
          height: 630,
          alt: "ubutube.org"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: "UbuTube",
      
      images: [
        {
          url: "https://ubutube.org/spirale.png",
          width: 1200,
          height: 630,
          alt: "ubutube.org"
        }
      ]
    }
    
  };

  export const viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
  };