"use client";

import { useSyncExternalStore } from "react";
import {
  isInstalledAndroidAppClient,
  readInstalledAndroidAppIdentity,
  type AndroidAppIdentity,
} from "@/lib/app-webview";

function subscribe() {
  return () => {};
}

function getSnapshot(): AndroidAppIdentity | null {
  return isInstalledAndroidAppClient() ? readInstalledAndroidAppIdentity() : null;
}

function getServerSnapshot(): AndroidAppIdentity | null {
  return null;
}

/** Tożsamość zainstalowanego APK — null na serwerze i w zwykłej przeglądarce. */
export function useInstalledAndroidAppIdentity(): AndroidAppIdentity | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
