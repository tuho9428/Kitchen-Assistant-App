import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kitchen Prep",
    short_name: "Kitchen Prep",
    description: "Prep book and kitchen timers, available offline",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f1",
    theme_color: "#345d49",
    icons: [
      { src: "/icons/kitchen-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icons/kitchen-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
