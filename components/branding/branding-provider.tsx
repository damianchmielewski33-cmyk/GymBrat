"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BrandingSlot } from "@/lib/app-branding-slots";

type BrandingAssetPublic = {
  url: string;
  updatedAt: number;
  mimeType: string;
};

type BrandingMap = Partial<Record<BrandingSlot, BrandingAssetPublic>>;

type BrandingContextValue = {
  assets: BrandingMap;
  ready: boolean;
  refresh: () => void;
};

const BrandingContext = createContext<BrandingContextValue>({
  assets: {},
  ready: false,
  refresh: () => {},
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<BrandingMap>({});
  const [ready, setReady] = useState(false);

  const load = useCallback(() => {
    void fetch("/api/branding", { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as { ok?: boolean; assets?: BrandingMap };
        if (data.ok && data.assets) setAssets(data.assets);
      })
      .catch(() => {
        /* keep defaults */
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!ready) return;
    const web = assets.icon_web ?? assets.icon_pwa ?? assets.logo_app;
    const apple = assets.icon_ios ?? assets.icon_pwa ?? assets.icon_web;
    const links: HTMLLinkElement[] = [];

    function setLink(rel: string, href: string, type?: string, sizes?: string) {
      let el = document.querySelector(
        `link[data-gymbrat-branding="${rel}"]`,
      ) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("data-gymbrat-branding", rel);
        document.head.appendChild(el);
        links.push(el);
      }
      el.rel = rel;
      el.href = href;
      if (type) el.type = type;
      else el.removeAttribute("type");
      if (sizes) el.setAttribute("sizes", sizes);
      else el.removeAttribute("sizes");
    }

    if (web) {
      setLink("icon", web.url, web.mimeType);
      setLink("shortcut icon", web.url, web.mimeType);
    }
    if (apple) {
      setLink("apple-touch-icon", apple.url, apple.mimeType, "180x180");
    }

    let manifest = document.querySelector(
      'link[rel="manifest"][data-gymbrat-branding="manifest"]',
    ) as HTMLLinkElement | null;
    if (!manifest) {
      const existing = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (existing) {
        existing.href = "/api/branding/manifest";
        existing.setAttribute("data-gymbrat-branding", "manifest");
      } else {
        manifest = document.createElement("link");
        manifest.rel = "manifest";
        manifest.href = "/api/branding/manifest";
        manifest.setAttribute("data-gymbrat-branding", "manifest");
        document.head.appendChild(manifest);
      }
    } else {
      manifest.href = "/api/branding/manifest";
    }
  }, [assets, ready]);

  const value = useMemo(
    () => ({ assets, ready, refresh: load }),
    [assets, ready, load],
  );

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}

export function useBrandingUrl(slot: BrandingSlot, fallbackSlots: BrandingSlot[] = []) {
  const { assets } = useBranding();
  if (assets[slot]?.url) return assets[slot]!.url;
  for (const s of fallbackSlots) {
    if (assets[s]?.url) return assets[s]!.url;
  }
  return null;
}
