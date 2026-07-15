import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
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
import { useTranslation } from "@/hooks/useTranslation";
import { useNativeBackgroundService } from "@/hooks/useNativeBackgroundService";
import { requestAllPermissions } from "@/hooks/usePermissions";
import { CountdownModal } from "@/components/CountdownModal";
import { useShakeDetector } from "@/hooks/useShakeDetector";
import { useVoiceTrigger } from "@/hooks/useVoiceTrigger";

function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    contacts,
    settings,
    checkInTimer,
    triggerSOS,
    startCheckIn,
    stopCheckIn,
    updateSettings,
    safeTimestamp,
  } = useApp();

  const [countdownVisible, setCountdownVisible] = useState(false);
  const [checkInRemaining, setCheckInRemaining] = useState(0);
  const [checkInMinutes, setCheckInMinutes] = useState(30);
  const [shakeCount, setShakeCount] = useState(0);


  useEffect(() => {
    if (!checkInTimer.active || !checkInTimer.startTime) return;
    const durationMs = checkInTimer.duration * 60 * 1000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - checkInTimer.startTime!;
      setCheckInRemaining(Math.max(0, durationMs - elapsed));
    }, 500);
    return () => clearInterval(interval);
  }, [checkInTimer]);


  useEffect(() => {
    if (shakeCount > 0) {
      const timer = setTimeout(() => setShakeCount(0), 2200);
      return () => clearTimeout(timer);
    }
  }, [shakeCount]);

  const handleCountdownConfirm = useCallback(() => {
    setCountdownVisible(false);
    triggerSOS();
  }, [triggerSOS]);

  const handleCountdownCancel = useCallback(() => {
    setCountdownVisible(false);
  }, []);

  const handleShake = useCallback(() => {
    if (!countdownVisible) setCountdownVisible(true);
  }, [countdownVisible]);

  const handleShakeCount = useCallback((count: number) => {
    setShakeCount(count);
  }, []);

  useShakeDetector(handleShake, settings.shakeSensitivity, false, handleShakeCount);

  const countdownVisibleRef = useRef(countdownVisible);
  countdownVisibleRef.current = countdownVisible;
  const handleVoiceSOS = useCallback(() => {
    if (!countdownVisibleRef.current) setCountdownVisible(true);
  }, []);

  useVoiceTrigger(
    settings.backgroundProtectionEnabled && settings.voiceTriggerActive && Platform.OS !== "web",
    handleVoiceSOS
  );

  const [permissionsReady, setPermissionsReady] = useState(false);
  const [isBackground, setIsBackground] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      setIsBackground(state === 'background' || state === 'inactive');
    });
    return () => sub.remove();
  }, []);

  // Request permissions on mount BEFORE starting service
  useEffect(() => {
    if (Platform.OS === "android") {
      requestAllPermissions().then(() => setPermissionsReady(true));
    } else {
      setPermissionsReady(true);
    }
  }, []);

  const emergencyPhoneNumbers = contacts.map((c: any) => c.phone).filter(Boolean);

  const onSOSTriggered = useCallback((source: string) => {
    // Only trigger from native service if countdown is not already visible
    // Native already started recording (and possibly SMS attempt) for shake/native triggers,
    // so skip re-triggering native from JS to avoid double-recording/duplicate SMS
    if (!countdownVisibleRef.current) {
      triggerSOS(true);
    }
  }, [triggerSOS]);

  // Native background service for shake+voice when app is in background
  useNativeBackgroundService(
    permissionsReady && settings.backgroundProtectionEnabled && Platform.OS === "android",
    onSOSTriggered,
    settings.triggerPhrases,
    emergencyPhoneNumbers,
    settings.audioRecording,
    settings.voiceTriggerActive,
    settings.shakeTriggerActive
  );

  const handleVoiceToggle = useCallback(() => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Voice Trigger",
        "Voice detection requires a native build. Install the app on your device to use this feature.",
        [{ text: "OK" }]
      );
      return;
    }
    try {
      updateSettings({ voiceTriggerActive: !settings.voiceTriggerActive });
      if (!settings.voiceTriggerActive) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Error", "Could not toggle voice detection.");
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
              {t("staySafeToday")}
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
            <Feather name="mic" size={16} color={settings.voiceTriggerActive ? "#fff" : colors.mutedForeground} />
            <Text
              style={[
                styles.voiceToggleText,
                {
                  color: settings.voiceTriggerActive ? "#fff" : colors.mutedForeground,
                  fontFamily: "Poppins_500Medium",
                },
              ]}
            >
              {settings.voiceTriggerActive ? t("listening") : t("voiceOff")}
            </Text>
          </Pressable>
        </View>

        {/* Status bar */}
        <View style={[styles.statusBar, { backgroundColor: colors.accentForeground + "12", borderRadius: 14 }]}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: contacts.length > 0 ? "#4CAF50" : colors.warning }]} />
            <Text style={[styles.statusText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {contacts.length} {t("contactsAdded")}
            </Text>
          </View>
          <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: settings.voiceTriggerActive ? "#4CAF50" : colors.mutedForeground }]} />
            <Text style={[styles.statusText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {settings.voiceTriggerActive ? t("voiceOn") : t("voiceOffStatus")}
            </Text>
          </View>
          <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: checkInTimer.active ? colors.warning : colors.mutedForeground }]} />
            <Text style={[styles.statusText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {checkInTimer.active ? t("checkInOn") : t("checkInOff")}
            </Text>
          </View>
        </View>

        {/* Shake feedback indicator */}
        {shakeCount > 0 && (
          <View style={[styles.shakeIndicator, { backgroundColor: colors.primary + "20", borderRadius: 12, borderColor: colors.primary + "40", borderWidth: 1 }]}>
            <Feather name="smartphone" size={16} color={colors.primary} />
            <Text style={[styles.shakeIndicatorText, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
              {shakeCount}/3 {t("shakeHint").split(" ")[0]}
            </Text>
            <View style={styles.shakeDotsRow}>
              {[1, 2, 3].map((n) => (
                <View
                  key={n}
                  style={[styles.shakeDot, { backgroundColor: n <= shakeCount ? colors.primary : colors.border }]}
                />
              ))}
            </View>
          </View>
        )}

        {/* Check-in timer */}
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 20, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: colors.accentForeground + "15" }]}>
              <Feather name="clock" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              {t("checkInTimer")}
            </Text>
          </View>

          {checkInTimer.active ? (
            <View style={styles.timerActive}>
              <Text style={[styles.timerValue, { color: colors.warning, fontFamily: "Poppins_700Bold" }]}>
                {formatCountdown(checkInRemaining)}
              </Text>
              <Text style={[styles.timerLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                {t("timerRemaining")}
              </Text>
              <Pressable
                style={[styles.timerBtn, { backgroundColor: colors.safe, borderRadius: 12 }]}
                onPress={stopCheckIn}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={[styles.timerBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                  {t("iAmSafe")}
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
                  {checkInMinutes}m {t("checkInTimer")}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Shake hint */}
        <View style={[styles.shakeHint, { backgroundColor: colors.accentForeground + "10", borderRadius: 14, borderColor: colors.border, borderWidth: 1 }]}>
          <Feather name="smartphone" size={16} color={colors.mutedForeground} />
          <Text style={[styles.shakeHintText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            {t("shakeHint")}
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
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 13 },
  appTitle: { fontSize: 26, letterSpacing: 3 },
  voiceToggle: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  voiceToggleText: { fontSize: 12 },
  statusBar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-around", paddingVertical: 12, paddingHorizontal: 16,
  },
  statusItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12 },
  statusDivider: { width: 1, height: 16 },
  shakeIndicator: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  shakeIndicatorText: { fontSize: 13, flex: 1 },
  shakeDotsRow: { flexDirection: "row", gap: 4 },
  shakeDot: { width: 10, height: 10, borderRadius: 5 },
  card: { padding: 20 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16 },
  timerActive: { alignItems: "center", gap: 8 },
  timerValue: { fontSize: 48, lineHeight: 52 },
  timerLabel: { fontSize: 12, textAlign: "center", marginBottom: 12 },
  timerBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  timerBtnText: { fontSize: 15 },
  minuteRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  minuteChip: { paddingHorizontal: 16, paddingVertical: 8 },
  minuteText: { fontSize: 13 },
  startBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, paddingVertical: 14,
  },
  startBtnText: { fontSize: 15 },
  shakeHint: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  shakeHintText: { fontSize: 13, flex: 1 },
});
