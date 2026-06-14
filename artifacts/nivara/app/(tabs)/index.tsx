import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { CountdownModal } from "@/components/CountdownModal";
import { useShakeDetector } from "@/hooks/useShakeDetector";

function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    contacts,
    settings,
    checkInTimer,
    triggerSOS,
    startCheckIn,
    stopCheckIn,
    updateSettings,
  } = useApp();

  const [countdownVisible, setCountdownVisible] = useState(false);
  const [checkInRemaining, setCheckInRemaining] = useState(0);
  const [checkInMinutes, setCheckInMinutes] = useState(30);

  useEffect(() => {
    if (!checkInTimer.active || !checkInTimer.startTime) return;
    const durationMs = checkInTimer.duration * 60 * 1000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - checkInTimer.startTime!;
      setCheckInRemaining(Math.max(0, durationMs - elapsed));
    }, 500);
    return () => clearInterval(interval);
  }, [checkInTimer]);

  const handleCountdownConfirm = useCallback(() => {
    setCountdownVisible(false);
    triggerSOS();
  }, [triggerSOS]);

  const handleCountdownCancel = useCallback(() => {
    setCountdownVisible(false);
  }, []);

  const handleShake = useCallback(() => {
    if (!countdownVisible) {
      setCountdownVisible(true);
    }
  }, [countdownVisible]);

  useShakeDetector(handleShake, settings.shakeSensitivity, !countdownVisible);

  const handleVoiceToggle = useCallback(() => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Voice Trigger",
        "Voice detection requires a native build. Install the app on your device to use this feature.",
        [{ text: "OK" }]
      );
      return;
    }
    const next = !settings.voiceTriggerActive;
    try {
      updateSettings({ voiceTriggerActive: next });
      if (next && Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Error", "Could not toggle voice detection. Please try again.");
    }
  }, [settings.voiceTriggerActive, updateSettings]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: botPad + 100 },
        ]}
      >
        {/* Header */}
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Stay safe today
            </Text>
            <Text style={[styles.appTitle, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>
              NIVARA
            </Text>
          </View>
          <Pressable
            style={[
              styles.voiceToggle,
              {
                backgroundColor: settings.voiceTriggerActive ? colors.primary : colors.muted,
                borderRadius: 100,
              },
            ]}
            onPress={handleVoiceToggle}
          >
            <Feather
              name="mic"
              size={16}
              color={settings.voiceTriggerActive ? "#fff" : colors.mutedForeground}
            />
            <Text
              style={[
                styles.voiceToggleText,
                {
                  color: settings.voiceTriggerActive ? "#fff" : colors.mutedForeground,
                  fontFamily: "Poppins_500Medium",
                },
              ]}
            >
              {settings.voiceTriggerActive ? "Listening" : "Voice Off"}
            </Text>
          </Pressable>
        </View>

        {/* Status bar */}
        <View
          style={[
            styles.statusBar,
            { backgroundColor: colors.accentForeground + "12", borderRadius: 14 },
          ]}
        >
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: contacts.length > 0 ? "#4CAF50" : colors.warning },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: settings.voiceTriggerActive ? "#4CAF50" : colors.mutedForeground },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {settings.voiceTriggerActive ? "Voice on" : "Voice off"}
            </Text>
          </View>
          <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: checkInTimer.active ? colors.warning : colors.mutedForeground },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {checkInTimer.active ? "Check-in on" : "Check-in off"}
            </Text>
          </View>
        </View>

        {/* Check-in timer */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderRadius: 20, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: colors.accentForeground + "15" }]}>
              <Feather name="clock" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Check-In Timer
            </Text>
          </View>

          {checkInTimer.active ? (
            <View style={styles.timerActive}>
              <Text style={[styles.timerValue, { color: colors.warning, fontFamily: "Poppins_700Bold" }]}>
                {formatCountdown(checkInRemaining)}
              </Text>
              <Text style={[styles.timerLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                remaining — SOS auto-triggers when timer ends
              </Text>
              <Pressable
                style={[styles.timerBtn, { backgroundColor: colors.safe, borderRadius: 12 }]}
                onPress={stopCheckIn}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={[styles.timerBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                  I'm Safe
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <View style={styles.minuteRow}>
                {[15, 30, 45, 60].map((min) => (
                  <Pressable
                    key={min}
                    style={[
                      styles.minuteChip,
                      {
                        backgroundColor: checkInMinutes === min ? colors.primary : colors.muted,
                        borderRadius: 100,
                      },
                    ]}
                    onPress={() => setCheckInMinutes(min)}
                  >
                    <Text
                      style={[
                        styles.minuteText,
                        {
                          color: checkInMinutes === min ? "#fff" : colors.mutedForeground,
                          fontFamily: "Poppins_500Medium",
                        },
                      ]}
                    >
                      {min}m
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[styles.startBtn, { backgroundColor: colors.primary, borderRadius: 12 }]}
                onPress={() => startCheckIn(checkInMinutes)}
              >
                <Feather name="play" size={16} color="#fff" />
                <Text style={[styles.startBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                  Start {checkInMinutes} min timer
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Quick actions — Fake Call only */}
        <Pressable
          style={[styles.fakeCallCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20 }]}
          onPress={() => router.push("/fake-call")}
        >
          <View style={[styles.fakeCallIcon, { backgroundColor: "#9C27B015" }]}>
            <Feather name="phone-incoming" size={22} color="#9C27B0" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fakeCallLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Fake Call
            </Text>
            <Text style={[styles.fakeCallSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Simulate an incoming call to escape a situation
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>

        {/* First contact quick call */}
        {contacts.length > 0 && (
          <Pressable
            style={[
              styles.quickContact,
              { backgroundColor: colors.primary + "15", borderRadius: 20, borderColor: colors.primary + "30", borderWidth: 1 },
            ]}
            onPress={() => Linking.openURL(`tel:${contacts[0].phone}`)}
          >
            <View style={[styles.contactAvatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { fontFamily: "Poppins_700Bold" }]}>
                {contacts[0].name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                {contacts[0].name}
              </Text>
              <Text style={[styles.contactPhone, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                {contacts[0].phone}
              </Text>
            </View>
            <View style={[styles.callBubble, { backgroundColor: colors.safe }]}>
              <Feather name="phone" size={18} color="#fff" />
            </View>
          </Pressable>
        )}

        {/* Shake hint */}
        <View
          style={[
            styles.shakeHint,
            { backgroundColor: colors.accentForeground + "10", borderRadius: 14, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <Feather name="smartphone" size={16} color={colors.mutedForeground} />
          <Text style={[styles.shakeHintText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Shake your phone 3 times to trigger SOS
          </Text>
        </View>
      </ScrollView>

      <CountdownModal
        visible={countdownVisible}
        onConfirm={handleCountdownConfirm}
        onCancel={handleCountdownCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 20 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: { fontSize: 13 },
  appTitle: { fontSize: 26, letterSpacing: 3 },
  voiceToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  voiceToggleText: { fontSize: 12 },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statusItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12 },
  statusDivider: { width: 1, height: 16 },
  card: { padding: 20 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16 },
  timerActive: { alignItems: "center", gap: 8 },
  timerValue: { fontSize: 48, lineHeight: 52 },
  timerLabel: { fontSize: 12, textAlign: "center", marginBottom: 12 },
  timerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  timerBtnText: { fontSize: 15 },
  minuteRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  minuteChip: { paddingHorizontal: 16, paddingVertical: 8 },
  minuteText: { fontSize: 13 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  startBtnText: { fontSize: 15 },
  fakeCallCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
    borderWidth: 1,
  },
  fakeCallIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  fakeCallLabel: { fontSize: 15 },
  fakeCallSub: { fontSize: 12, marginTop: 2 },
  quickContact: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 18 },
  contactName: { fontSize: 15 },
  contactPhone: { fontSize: 12 },
  callBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  shakeHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  shakeHintText: { fontSize: 13, flex: 1 },
});
