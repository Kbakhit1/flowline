import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مِرسال · Mirsal",
    short_name: "Mirsal",
    description: "كل طلب في الشركة فقاعة واحدة. تنزل للفريق، وترجع بخبر.",
    start_url: `${bp}/app/`,
    scope: `${bp}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f7f3",
    theme_color: "#0e6b55",
    lang: "ar",
    dir: "rtl",
    icons: [
      { src: `${bp}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: `${bp}/icon-maskable.svg`, sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
