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

  it("preferuje most AwpAndroid.vibrate", () => {
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
