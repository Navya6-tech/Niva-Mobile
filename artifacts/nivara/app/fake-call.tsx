import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

type CallState = "ringing" | "active" | "ended";

export default function FakeCallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings } = useApp();
  const [callState, setCallState] = useState<CallState>("ringing");
  const [duration, setDuration] = useState(0);
  const ringPulse = useRef(new Animated.Value(1)).current;
  const acceptScale = useRef(new Animated.Value(1)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();

    if (Platform.OS !== "web") {
      const hapticInterval = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 1500);
      return () => {
        anim.stop();
        clearInterval(hapticInterval);
      };
    }

    return () => anim.stop();
  }, [ringPulse]);

  useEffect(() => {
    if (callState !== "active") return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleAccept = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCallState("active");
  };

  const handleDecline = () => {
    router.back();
  };

  const handleEnd = () => {
    setCallState("ended");
    setTimeout(() => router.back(), 1500);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      {/* Background gradient effect */}
      <View style={[StyleSheet.absoluteFill, styles.bgOverlay]} />

      <View style={styles.callerSection}>
        <Animated.View
          style={[
            styles.avatarRing,
            {
              borderColor: "rgba(255,255,255,0.3)",
              transform: [{ scale: callState === "ringing" ? ringPulse : new Animated.Value(1) }],
            },
          ]}
        />
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {settings.fakeCallerName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.callerName}>{settings.fakeCallerName}</Text>
        <Text style={styles.callerNumber}>{settings.fakeCallerNumber}</Text>

        {callState === "ringing" && (
          <Text style={styles.statusText}>Incoming call...</Text>
        )}
        {callState === "active" && (
          <Text style={styles.statusText}>{formatDuration(duration)}</Text>
        )}
        {callState === "ended" && (
          <Text style={styles.statusText}>Call ended</Text>
        )}
      </View>

      {callState === "ringing" && (
        <View style={styles.actions}>
          <View style={styles.actionItem}>
            <Pressable
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={handleDecline}
            >
              <Feather name="phone-off" size={28} color="#fff" />
            </Pressable>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          <View style={styles.actionItem}>
            <Animated.View style={{ transform: [{ scale: acceptScale }] }}>
              <Pressable
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={handleAccept}
              >
                <Feather name="phone" size={28} color="#fff" />
              </Pressable>
            </Animated.View>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>
      )}

      {callState === "active" && (
        <View style={styles.activeActions}>
          <View style={styles.activeGrid}>
            {[
              { icon: "mic-off" as const, label: "Mute" },
              { icon: "volume-2" as const, label: "Speaker" },
              { icon: "hash" as const, label: "Keypad" },
            ].map((btn) => (
              <View key={btn.label} style={styles.activeActionItem}>
                <Pressable
                  style={[styles.activeActionBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
                >
                  <Feather name={btn.icon} size={22} color="#fff" />
                </Pressable>
                <Text style={styles.activeActionLabel}>{btn.label}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.actionBtn, styles.declineBtn, { marginTop: 32 }]}
            onPress={handleEnd}
          >
            <Feather name="phone-off" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.actionLabel}>End</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
  },
  bgOverlay: {
    backgroundColor: "rgba(20, 0, 40, 0.9)",
  },
  callerSection: {
    alignItems: "center",
    marginTop: 60,
    gap: 10,
  },
  avatarRing: {
    position: "absolute",
    top: -18,
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 2,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#4A148C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarInitial: {
    fontSize: 44,
    color: "#fff",
    fontFamily: "Poppins_700Bold",
  },
  callerName: {
    fontSize: 32,
    color: "#fff",
    fontFamily: "Poppins_700Bold",
  },
  callerNumber: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Poppins_400Regular",
  },
  statusText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Poppins_400Regular",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 60,
  },
  actionItem: {
    alignItems: "center",
    gap: 10,
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtn: { backgroundColor: "#D32F2F" },
  acceptBtn: { backgroundColor: "#2E7D32" },
  actionLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
  },
  activeActions: {
    alignItems: "center",
    width: "100%",
    marginBottom: 60,
  },
  activeGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 8,
  },
  activeActionItem: { alignItems: "center", gap: 8 },
  activeActionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  activeActionLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
  },
});
