import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BAWAAL — desi party games",
    short_name: "BAWAAL",
    description: "Desi party games for your family and friends. Put it on the big screen, join from your phones, and let the madness begin.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6ee",
    theme_color: "#fbf6ee",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
