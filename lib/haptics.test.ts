import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HAPTIC_NEW_MAX,
  HAPTIC_TAP,
  hapticNewMax,
  hapticTap,
  vibrate,
} from "@/lib/haptics";

describe("haptics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("używa navigator.vibrate gdy most niedostępny", () => {
    const navVibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: navVibrate });
    expect(vibrate(HAPTIC_TAP)).toBe(true);
    expect(navVibrate).toHaveBeenCalledWith(HAPTIC_TAP);
  });

  it("preferuje most GymBratAndroid.vibrate", () => {
    const bridgeVibrate = vi.fn();
    const navVibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: navVibrate });
    vi.stubGlobal("window", {
      GymBratAndroid: {
        getVersionName: () => "1.0",
        getVersionCode: () => 1,
        checkUpdate: () => undefined,
        vibrate: bridgeVibrate,
      },
    });
    hapticNewMax();
    expect(bridgeVibrate).toHaveBeenCalledWith(HAPTIC_NEW_MAX.join(","));
    expect(navVibrate).not.toHaveBeenCalled();
  });

  it("używa mostu GymBratIos.vibrate gdy brak Androida", () => {
    const bridgeVibrate = vi.fn();
    const navVibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: navVibrate });
    vi.stubGlobal("window", {
      GymBratIos: {
        getVersionName: () => "1.0.0",
        getVersionCode: () => 1,
        vibrate: bridgeVibrate,
      },
    });
    hapticTap();
    expect(bridgeVibrate).toHaveBeenCalledWith(HAPTIC_TAP.join(","));
    expect(navVibrate).not.toHaveBeenCalled();
  });

  it("fallback do AwpAndroid.vibrate gdy brak GymBratAndroid", () => {
    const bridgeVibrate = vi.fn();
    const navVibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: navVibrate });
    vi.stubGlobal("window", {
      AwpAndroid: {
        getVersionName: () => "1.0",
        getVersionCode: () => 1,
        checkUpdate: () => undefined,
        vibrate: bridgeVibrate,
      },
    });
    hapticNewMax();
    expect(bridgeVibrate).toHaveBeenCalledWith(HAPTIC_NEW_MAX.join(","));
    expect(navVibrate).not.toHaveBeenCalled();
  });

  it("hapticTap wywołuje krótki wzorzec", () => {
    const navVibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: navVibrate });
    hapticTap();
    expect(navVibrate).toHaveBeenCalledWith(HAPTIC_TAP);
  });

  it("zwraca false bez API wibracji", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", {});
    expect(vibrate(HAPTIC_TAP)).toBe(false);
  });
});
