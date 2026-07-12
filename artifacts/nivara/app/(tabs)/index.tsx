import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
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
import { useTranslation } from "@/hooks/useTranslation";
import { useNativeBackgroundService } from "@/hooks/useNativeBackgroundService";
import { requestAllPermissions } from "@/hooks/usePermissions";
import { CountdownModal } from "@/components/CountdownModal";
import { useShakeDetector } from "@/hooks/useShakeDetector";
import { useVoiceTrigger } from "@/hooks/useVoiceTrigger";
import {
  RecordingMeta,
  loadRecordings,
  saveRecordingMeta,
  deleteRecordingById,
  formatRecordingDate,
  formatRecordingDuration,
  formatRecordingSize,
  AUTO_DELETE_MS,
} from "@/utils/recordings";

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

  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const soundRef = useRef<{ unloadAsync: () => Promise<void>; pauseAsync: () => Promise<void> } | null>(null);

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
    loadRecordings().then((list) => {
      list.sort((a, b) => b.date - a.date);
      setRecordings(list);
    });
  }, [safeTimestamp]);

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
    if (!countdownVisibleRef.current) {
      triggerSOS();
    }
  }, [triggerSOS]);

  // Native background service for shake+voice when app is in background
  useNativeBackgroundService(
    permissionsReady && settings.backgroundProtectionEnabled && Platform.OS === "android",
    onSOSTriggered,
    settings.triggerPhrases,
    emergencyPhoneNumbers,
    settings.audioRecording,
    settings.voiceTriggerActive
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

  const handlePlay = useCallback(async (rec: RecordingMeta) => {
    if (Platform.OS === "web") {
      Alert.alert(t("recordings"), "Audio playback requires a native device.");
      return;
    }
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playingId === rec.id) {
        setPlayingId(null);
        setPlayProgress(0);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Audio } = require("expo-av");
      const { sound } = await Audio.Sound.createAsync(
        { uri: rec.uri },
        { shouldPlay: true },
        (status: { isLoaded?: boolean; positionMillis?: number; durationMillis?: number; didJustFinish?: boolean }) => {
          if (status.isLoaded && status.durationMillis) {
            setPlayProgress((status.positionMillis ?? 0) / status.durationMillis);
          }
          if (status.didJustFinish) {
            setPlayingId(null);
            setPlayProgress(0);
          }
        }
      );
      soundRef.current = sound;
      setPlayingId(rec.id);
    } catch {
      Alert.alert("Error", "Could not play this recording.");
    }
  }, [playingId, t]);

  const handlePause = useCallback(async () => {
    try {
      await soundRef.current?.pauseAsync();
      setPlayingId(null);
    } catch {}
  }, []);

  const handleKeep = useCallback(async (rec: RecordingMeta) => {
    const updated = { ...rec, keepForever: !rec.keepForever };
    await saveRecordingMeta(updated);
    loadRecordings().then((list) => {
      list.sort((a, b) => b.date - a.date);
      setRecordings(list);
    });
  }, []);

  const handleDeleteRecording = useCallback((rec: RecordingMeta) => {
    const doDelete = async () => {
      if (playingId === rec.id) {
        await soundRef.current?.unloadAsync();
        soundRef.current = null;
        setPlayingId(null);
      }
      await deleteRecordingById(rec.id);
      loadRecordings().then((list) => {
        list.sort((a, b) => b.date - a.date);
        setRecordings(list);
      });
    };

    if (Platform.OS === "web") { doDelete(); return; }
    Alert.alert(
      t("deleteRecordingTitle"),
      t("deleteRecordingConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("delete"), style: "destructive", onPress: doDelete },
      ]
    );
  }, [playingId, t]);

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
        <View style={[styles.shakeHint, { backgroundColor: colors.accentForeground + "10", borderRadius: 14, borderColor: colors.border, borderWidth: 1 }]}>
          <Feather name="smartphone" size={16} color={colors.mutedForeground} />
          <Text style={[styles.shakeHintText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            {t("shakeHint")}
          </Text>
        </View>

        {/* Recordings */}
        <View style={styles.recordingsHeader}>
          <Feather name="mic" size={18} color={colors.primary} />
          <Text style={[styles.recordingsTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
            {t("recordings")}
          </Text>
        </View>

        {recordings.length === 0 ? (
          <View style={[styles.recordingsEmpty, { backgroundColor: colors.card, borderRadius: 16, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.recordingsEmptyText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {t("noRecordingsYet")}
            </Text>
          </View>
        ) : (
          <View style={styles.recordingsList}>
            <View style={[styles.autoDeleteNote, { backgroundColor: colors.warning + "15", borderRadius: 10, borderColor: colors.warning + "40", borderWidth: 1 }]}>
              <Feather name="clock" size={12} color={colors.warning} />
              <Text style={[styles.autoDeleteText, { color: colors.warning, fontFamily: "Poppins_400Regular" }]}>
                {t("autoDeleteWarning")}
              </Text>
            </View>
            {recordings.map((rec) => {
              const isPlaying = playingId === rec.id;
              const hoursLeft = Math.max(0, Math.ceil((AUTO_DELETE_MS - (Date.now() - rec.date)) / (1000 * 60 * 60)));
              return (
                <View
                  key={rec.id}
                  style={[
                    styles.recCard,
                    {
                      backgroundColor: colors.card,
                      borderRadius: 16,
                      borderColor: rec.keepForever ? colors.primary + "50" : colors.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  {rec.keepForever && (
                    <View style={[styles.savedBadge, { backgroundColor: colors.primary }]}>
                      <Feather name="bookmark" size={10} color="#fff" />
                      <Text style={[styles.savedBadgeText, { fontFamily: "Poppins_600SemiBold" }]}>
                        {t("saved")}
                      </Text>
                    </View>
                  )}
                  <View style={styles.recMeta}>
                    <View style={[styles.recIconWrap, { backgroundColor: colors.primary + "15" }]}>
                      <Feather name="mic" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recDate, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                        {formatRecordingDate(rec.date)}
                      </Text>
                      <Text style={[styles.recInfo, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                        {formatRecordingDuration(rec.durationMs)} · {formatRecordingSize(rec.size)}
                      </Text>
                      {!rec.keepForever && (
                        <Text style={[styles.autoDeleteLabel, { color: colors.warning, fontFamily: "Poppins_400Regular" }]}>
                          {t("autoDeletesIn")} {hoursLeft}{t("hours")}
                        </Text>
                      )}
                    </View>
                  </View>

                  {isPlaying && (
                    <View style={[styles.progressBarBg, { backgroundColor: colors.muted, borderRadius: 4 }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { backgroundColor: colors.primary, borderRadius: 4, width: `${playProgress * 100}%` },
                        ]}
                      />
                    </View>
                  )}

                  <View style={[styles.recActions, { borderTopColor: colors.border }]}>
                    <Pressable
                      style={[styles.recBtn, { backgroundColor: colors.primary + "15", borderRadius: 10 }]}
                      onPress={() => isPlaying ? handlePause() : handlePlay(rec)}
                    >
                      <Feather name={isPlaying ? "pause" : "play"} size={14} color={colors.primary} />
                      <Text style={[styles.recBtnText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>
                        {isPlaying ? t("pause") : t("play")}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.recBtn, { backgroundColor: rec.keepForever ? colors.primary + "20" : colors.muted, borderRadius: 10 }]}
                      onPress={() => handleKeep(rec)}
                    >
                      <Feather name="bookmark" size={14} color={rec.keepForever ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.recBtnText, { color: rec.keepForever ? colors.primary : colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
                        {rec.keepForever ? t("saved") : t("keep")}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.recBtn, { backgroundColor: colors.destructive + "15", borderRadius: 10 }]}
                      onPress={() => handleDeleteRecording(rec)}
                    >
                      <Feather name="trash-2" size={14} color={colors.destructive} />
                      <Text style={[styles.recBtnText, { color: colors.destructive, fontFamily: "Poppins_500Medium" }]}>
                        {t("delete")}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
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
  quickContact: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 18 },
  contactName: { fontSize: 15 },
  contactPhone: { fontSize: 12 },
  callBubble: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  shakeHint: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  shakeHintText: { fontSize: 13, flex: 1 },
  recordingsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: -8 },
  recordingsTitle: { fontSize: 16 },
  recordingsEmpty: { padding: 20 },
  recordingsEmptyText: { fontSize: 13, lineHeight: 20 },
  recordingsList: { gap: 12 },
  autoDeleteNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  autoDeleteText: { fontSize: 11, flex: 1 },
  recCard: { overflow: "hidden" },
  savedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-end", marginRight: 12, marginTop: 8,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100,
  },
  savedBadgeText: { color: "#fff", fontSize: 10 },
  recMeta: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, paddingBottom: 10 },
  recIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  recDate: { fontSize: 13 },
  recInfo: { fontSize: 11, marginTop: 2 },
  autoDeleteLabel: { fontSize: 10, marginTop: 2 },
  progressBarBg: { height: 4, marginHorizontal: 14, marginBottom: 8 },
  progressBarFill: { height: 4 },
  recActions: {
    flexDirection: "row", gap: 6, padding: 10, borderTopWidth: 1,
  },
  recBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 4, paddingVertical: 9,
  },
  recBtnText: { fontSize: 12 },
});
