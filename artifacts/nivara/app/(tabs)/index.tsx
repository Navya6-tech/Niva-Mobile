import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
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
import { SOSButton } from "@/components/SOSButton";
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

  const handleSOSPress = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    setCountdownVisible(true);
  }, []);

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

  useShakeDetector(
    handleShake,
    settings.shakeSensitivity,
    !countdownVisible && !settings.voiceTriggerActive === false
  );

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
                backgroundColor: settings.voiceTriggerActive
                  ? colors.primary
                  : colors.muted,
                borderRadius: 100,
              },
            ]}
            onPress={() =>
              updateSettings({ voiceTriggerActive: !settings.voiceTriggerActive })
            }
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
                {
                  backgroundColor:
                    contacts.length > 0 ? "#4CAF50" : colors.warning,
                },
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
                {
                  backgroundColor: settings.voiceTriggerActive
                    ? "#4CAF50"
                    : colors.mutedForeground,
                },
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
                {
                  backgroundColor: checkInTimer.active ? colors.warning : colors.mutedForeground,
                },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {checkInTimer.active ? "Check-in on" : "Check-in off"}
            </Text>
          </View>
        </View>

        {/* SOS button */}
        <View style={styles.sosSection}>
          <SOSButton onPress={handleSOSPress} size={140} />
          <Text style={[styles.sosHint, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Tap to send emergency alert
          </Text>
          <Text style={[styles.sosHint2, { color: colors.mutedForeground + "80", fontFamily: "Poppins_400Regular" }]}>
            or shake your phone 3 times
          </Text>
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
                        backgroundColor:
                          checkInMinutes === min ? colors.primary : colors.muted,
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

        {/* Quick actions */}
        <View style={styles.quickGrid}>
          <Pressable
            style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20 }]}
            onPress={() => Linking.openURL("tel:100")}
          >
            <Feather name="phone" size={22} color={colors.destructive} />
            <Text style={[styles.quickLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Police
            </Text>
            <Text style={[styles.quickNum, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              100
            </Text>
          </Pressable>

          <Pressable
            style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20 }]}
            onPress={() => Linking.openURL("tel:108")}
          >
            <Feather name="activity" size={22} color="#F44336" />
            <Text style={[styles.quickLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Ambulance
            </Text>
            <Text style={[styles.quickNum, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              108
            </Text>
          </Pressable>

          <Pressable
            style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20 }]}
            onPress={() => Linking.openURL("tel:1091")}
          >
            <Feather name="shield" size={22} color={colors.primary} />
            <Text style={[styles.quickLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Helpline
            </Text>
            <Text style={[styles.quickNum, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              1091
            </Text>
          </Pressable>

          <Pressable
            style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20 }]}
            onPress={() => router.push("/fake-call")}
          >
            <Feather name="phone-incoming" size={22} color="#9C27B0" />
            <Text style={[styles.quickLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              Fake Call
            </Text>
            <Text style={[styles.quickNum, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Escape
            </Text>
          </Pressable>
        </View>

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

        {contacts.length === 0 && (
          <Pressable
            style={[
              styles.addContactBanner,
              { backgroundColor: colors.accentForeground + "10", borderRadius: 20, borderColor: colors.primary + "30", borderWidth: 1 },
            ]}
            onPress={() => router.push("/(tabs)/contacts")}
          >
            <Feather name="user-plus" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
                Add Emergency Contacts
              </Text>
              <Text style={[styles.bannerSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                They'll receive your SOS alert
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </Pressable>
        )}
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
  sosSection: { alignItems: "center", paddingVertical: 24, gap: 16 },
  sosHint: { fontSize: 14, marginTop: 8 },
  sosHint2: { fontSize: 12, marginTop: -8 },
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
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  quickCard: {
    width: "47%",
    padding: 18,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  quickLabel: { fontSize: 14 },
  quickNum: { fontSize: 12 },
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
  addContactBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },
  bannerTitle: { fontSize: 14 },
  bannerSub: { fontSize: 12 },
});
