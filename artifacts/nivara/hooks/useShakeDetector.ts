import { useEffect, useRef } from "react";
import { Platform } from "react-native";

const SHAKE_THRESHOLD = { low: 2.5, medium: 2.0, high: 1.6 };
const SHAKE_COUNT_REQUIRED = 3;
const SHAKE_WINDOW_MS = 1500;

export function useShakeDetector(
  onShake: () => void,
  sensitivity: "low" | "medium" | "high" = "medium",
  enabled: boolean = true
) {
  const shakeCountRef = useRef(0);
  const shakeWindowStartRef = useRef(0);
  const lastMagnitudeRef = useRef(0);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;

    let subscription: { remove: () => void } | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Accelerometer } = require("expo-sensors") as {
        Accelerometer: {
          setUpdateInterval: (ms: number) => void;
          addListener: (cb: (data: { x: number; y: number; z: number }) => void) => { remove: () => void };
        };
      };

      Accelerometer.setUpdateInterval(100);
      subscription = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const delta = Math.abs(magnitude - lastMagnitudeRef.current);
        lastMagnitudeRef.current = magnitude;

        const threshold = SHAKE_THRESHOLD[sensitivity];
        if (delta > threshold) {
          const now = Date.now();
          if (now - shakeWindowStartRef.current > SHAKE_WINDOW_MS) {
            shakeWindowStartRef.current = now;
            shakeCountRef.current = 0;
          }
          shakeCountRef.current += 1;
          if (shakeCountRef.current >= SHAKE_COUNT_REQUIRED) {
            shakeCountRef.current = 0;
            onShake();
          }
        }
      });
    } catch {
    }

    return () => {
      subscription?.remove();
    };
  }, [enabled, sensitivity, onShake]);
}
