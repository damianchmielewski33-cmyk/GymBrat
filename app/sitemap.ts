import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  const origin = base.replace(/\/$/, "");
  return [
    {
      url: `${origin}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${origin}/login`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${origin}/register`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${origin}/regulamin`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/polityka-prywatnosci`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
