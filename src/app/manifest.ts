import type { MetadataRoute } from "next";
import { themeColors } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Private Lab",
    short_name: "Private Lab",
    description: "Eine private Spielwiese für kleine Apps und Prototypen.",
    lang: "de",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f3f4f1",
    // Same as the page's theme-color meta. A different (dark) color here
    // showed as a thin dark bar at the top while the installed app reloads.
    theme_color: themeColors.light,
    // Android: "Teilen" in another app (e.g. Amazon) → Private Lab adds a wish.
    share_target: {
      action: "/m/wishlist",
      method: "GET",
      params: { title: "shared_title", text: "shared_text", url: "shared_url" },
    },
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
