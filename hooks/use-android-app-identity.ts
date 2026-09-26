"use client";

import { useSyncExternalStore } from "react";
import {
  isInstalledAndroidAppClient,
  readInstalledAndroidAppIdentity,
  stableAndroidIdentity,
  type AndroidAppIdentity,
} from "@/lib/app-webview";

function subscribe() {
  return () => {};
}

let cachedSnapshot: AndroidAppIdentity | null = null;

function getSnapshot(): AndroidAppIdentity | null {
  const next = isInstalledAndroidAppClient() ? readInstalledAndroidAppIdentity() : null;
  cachedSnapshot = stableAndroidIdentity(next, cachedSnapshot);
  return cachedSnapshot;
}

function getServerSnapshot(): AndroidAppIdentity | null {
  return null;
}

/** Tożsamość zainstalowanego APK — null na serwerze i w zwykłej przeglądarce. */
export function useInstalledAndroidAppIdentity(): AndroidAppIdentity | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
