import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { saveRecordingMeta } from "@/utils/recordings";
import * as FileSystem from "expo-file-system";

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function formatDateTime(date: Date) {
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  const mo = (date.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

export default function SOSActiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { contacts, sosStartTime, markSafe } = useApp();
  const [elapsed, setElapsed] = useState(0);
  const [locationText, setLocationText] = useState("Getting location...");
  const [smsState, setSmsState] = useState<"idle" | "sending" | "sent" | "failed" | "denied">("idle");
  const [smsError, setSmsError] = useState<string | null>(null);
  const [locationLink, setLocationLink] = useState<string | null>(null);
  const lastLatLng = useRef<{ lat: string; lng: string } | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingUriRef = useRef<string | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "requesting" | "recording" | "stopped" | "error">("idle");
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const recordingMsRef = useRef(0);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStart = useRef<number | null>(null);
  const isStopping = useRef(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const [playState, setPlayState] = useState<"idle" | "playing" | "paused">("idle");
  const [playProgress, setPlayProgress] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
    getLocationAndSendSOS();
    const recordTimer = setTimeout(() => { startRecording(); }, 800);
    const interval = setInterval(() => {
      setElapsed(Date.now() - (sosStartTime ?? Date.now()));
    }, 1000);
    return () => {
      clearTimeout(recordTimer);
      clearInterval(interval);
      stopRecordingInternal();
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    if (Platform.OS === "web") return;
    setRecordingState("requesting");
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setRecordingState("error");
        Alert.alert(
          "Microphone Permission Required",
          "NIVARA needs microphone access to record audio evidence during SOS.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Skip", style: "cancel" },
          ]
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      recordingStart.current = Date.now();
      recordingMsRef.current = 0;
      setRecordingState("recording");
      recordingInterval.current = setInterval(() => {
        const ms = Date.now() - (recordingStart.current ?? Date.now());
        recordingMsRef.current = ms;
        setRecordingMs(ms);
      }, 500);
    } catch (e) {
      setRecordingState("error");
      console.error("Recording error:", e);
    }
  };

  const stopRecordingInternal = async (): Promise<string | null> => {
    if (!recordingRef.current || isStopping.current) return recordingUriRef.current;
    isStopping.current = true;
    try {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      const rec = recordingRef.current;
      recordingRef.current = null;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (uri) {
        recordingUriRef.current = uri;
        setRecordingUri(uri);
        setRecordingState("stopped");
        const info = await FileSystem.getInfoAsync(uri, { size: true });
        const size = (info as { size?: number }).size ?? 0;
        const durationMs = recordingMsRef.current || (Date.now() - (recordingStart.current ?? Date.now()));
        await saveRecordingMeta({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          uri,
          date: Date.now(),
          durationMs,
          size,
          keepForever: false,
        });
        return uri;
      }
    } catch (e) {
      console.error("Stop recording error:", e);
    } finally {
      isStopping.current = false;
    }
    return null;
  };

  const handlePlay = async () => {
    const uri = recordingUri || recordingUriRef.current;
    if (!uri) return;
    if (Platform.OS === "web") {
      Alert.alert("Playback", "Audio playback requires a native device.");
      return;
    }
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.durationMillis) {
            setPlayProgress((status.positionMillis ?? 0) / status.durationMillis);
          }
          if (status.isLoaded && status.didJustFinish) {
            setPlayState("idle");
            setPlayProgress(0);
          }
        }
      );
      soundRef.current = sound;
      setPlayState("playing");
    } catch (e) {
      Alert.alert("Error", "Could not play recording. Try again.");
    }
  };

  const handlePause = async () => {
    try { await soundRef.current?.pauseAsync(); setPlayState("paused"); } catch {}
  };

  const handleResume = async () => {
    try { await soundRef.current?.playAsync(); setPlayState("playing"); } catch {}
  };

  const getLocationAndSendSOS = async () => {
    try {
      if (Platform.OS === "web") {
        setLocationText("Location unavailable on web");
        buildAndSendSMS("0.0000", "0.0000");
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationText("Location permission denied");
        buildAndSendSMS("unknown", "unknown");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      const link = `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      setLocationLink(link);
      setLocationText(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      const lat = latitude.toFixed(6);
      const lng = longitude.toFixed(6);
      lastLatLng.current = { lat, lng };
      buildAndSendSMS(lat, lng);
    } catch {
      setLocationText("Could not get location");
      buildAndSendSMS("unknown", "unknown");
    }
  };

  const buildAndSendSMS = async (lat: string, lng: string) => {
    if (contacts.length === 0) return;
    setSmsState("sending");
    const now = new Date();
    const link = lat === "unknown" ? "Location unavailable" : `https://maps.google.com/?q=${lat},${lng}`;
    const message =
      `NIVARA EMERGENCY ALERT\n` +
      `I may need help. Please reach me immediately.\n` +
      `My location: ${link}\n` +
      `Time: ${formatDateTime(now)}\n` +
      `Sent via NIVARA Safety App`;
    const phones = contacts.map((c) => c.phone);
    if (Platform.OS === "web") { setSmsState("sent"); return; }
    if (Platform.OS !== "android") { setSmsState("failed"); return; }
    try {
      const { PermissionsAndroid } = require("react-native") as typeof import("react-native");
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        setSmsState("denied");
        setSmsError(`Permission result: ${granted}`);
        return;
      }
      const { sendSMS } = require("direct-sms") as { sendSMS: (phones: string[], msg: string) => void };
      sendSMS(phones, message);
      setSmsState("sent");
      setSmsError(null);
    } catch (e: unknown) {
      setSmsState("failed");
      setSmsError(e instanceof Error ? e.message : String(e));
    }
  };

  const openLocation = () => { if (locationLink) Linking.openURL(locationLink); };

  const handleMarkSafe = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await stopRecordingInternal();
    await soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    markSafe();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: "#1a0000", paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.alertBadge, { backgroundColor: colors.destructive, borderRadius: 100, transform: [{ scale: pulse }] }]}>
          <Feather name="alert-triangle" size={20} color="#fff" />
          <Text style={[styles.alertBadgeText, { fontFamily: "Poppins_700Bold" }]}>ALERT ACTIVE</Text>
        </Animated.View>

        <Text style={[styles.timer, { color: "#FFFFFF", fontFamily: "Poppins_700Bold" }]}>{formatDuration(elapsed)}</Text>
        <Text style={[styles.timerLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>SOS active duration</Text>

        <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
          <View style={styles.cardRow}>
            <Feather
              name="mic"
              size={18}
              color={recordingState === "recording" ? "#FF5252" : recordingState === "stopped" ? "#4CAF50" : "rgba(255,255,255,0.4)"}
            />
            <View style={styles.cardInfo}>
              <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>Audio Recording</Text>
              <Text style={[styles.cardValue, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>
                {recordingState === "requesting" ? "Requesting mic permission..." :
                 recordingState === "recording" ? `Recording ${formatDuration(recordingMs)}` :
                 recordingState === "stopped" ? "Recording saved" :
                 recordingState === "error" ? "Mic permission denied" : "Starting..."}
              </Text>
            </View>
            {recordingState === "recording" && <View style={styles.recDot} />}
            {recordingState === "stopped" && <Feather name="check-circle" size={18} color="#4CAF50" />}
          </View>

          {recordingState === "stopped" && (recordingUri || recordingUriRef.current) && (
            <View style={[styles.playbackRow, { borderTopColor: "rgba(255,255,255,0.1)" }]}>
              {playState === "idle" && (
                <Pressable style={styles.playBtn} onPress={handlePlay}>
                  <Feather name="play" size={16} color="#fff" />
                  <Text style={[styles.playBtnText, { fontFamily: "Poppins_500Medium" }]}>Play Recording</Text>
                </Pressable>
              )}
              {playState === "playing" && (
                <Pressable style={styles.playBtn} onPress={handlePause}>
                  <Feather name="pause" size={16} color="#fff" />
                  <Text style={[styles.playBtnText, { fontFamily: "Poppins_500Medium" }]}>Pause</Text>
                </Pressable>
              )}
              {playState === "paused" && (
                <Pressable style={styles.playBtn} onPress={handleResume}>
                  <Feather name="play" size={16} color="#fff" />
                  <Text style={[styles.playBtnText, { fontFamily: "Poppins_500Medium" }]}>Resume</Text>
                </Pressable>
              )}
              {playState !== "idle" && (
                <View style={[styles.progressBarBg, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                  <View style={[styles.progressBarFill, { backgroundColor: "#fff", width: `${playProgress * 100}%` }]} />
                </View>
              )}
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
          <View style={styles.cardRow}>
            <Feather name="map-pin" size={18} color={colors.secondary} />
            <View style={styles.cardInfo}>
              <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>Live Location</Text>
              <Text style={[styles.cardValue, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>{locationText}</Text>
            </View>
            {locationLink && (
              <Pressable onPress={openLocation}>
                <Feather name="external-link" size={18} color={colors.secondary} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
          <View style={styles.cardRow}>
            <Feather name="message-circle" size={18} color={smsState === "sent" ? "#4CAF50" : smsState === "denied" || smsState === "failed" ? "#FF5252" : colors.secondary} />
            <View style={styles.cardInfo}>
              <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>Alert SMS</Text>
              <Text style={[styles.cardValue, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>
                {smsState === "sent" ? `Sent to ${contacts.length} contact${contacts.length !== 1 ? "s" : ""}` :
                 smsState === "sending" ? "Sending..." :
                 smsState === "denied" ? "Permission denied - tap to retry" :
                 smsState === "failed" ? "Failed - tap to retry" :
                 contacts.length === 0 ? "No contacts added" : "Waiting..."}
              </Text>
              {smsError != null && <Text style={{ color: "#FF5252", fontSize: 10, fontFamily: "Poppins_400Regular", marginTop: 4 }} selectable>{smsError}</Text>}
            </View>
            {smsState === "sent" && <Feather name="check-circle" size={18} color="#4CAF50" />}
            {(smsState === "failed" || smsState === "denied") && (
              <Pressable onPress={() => { const ll = lastLatLng.current; buildAndSendSMS(ll?.lat ?? "unknown", ll?.lng ?? "unknown"); }}>
                <Feather name="refresh-cw" size={18} color="#FF5252" />
              </Pressable>
            )}
          </View>
        </View>

        {contacts.length > 0 && (
          <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
            <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular", marginBottom: 12 }]}>Emergency Contacts Alerted</Text>
            {contacts.map((c) => (
              <View key={c.id} style={styles.contactRow}>
                <View style={[styles.contactAvatar, { backgroundColor: colors.primary + "40" }]}>
                  <Text style={[styles.contactInitial, { color: colors.secondary, fontFamily: "Poppins_700Bold" }]}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={[styles.contactName, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>{c.name}</Text>
                  <Text style={[styles.contactPhone, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>{c.phone}</Text>
                </View>
                <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                  <Feather name="phone" size={16} color="#4CAF50" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable style={[styles.safeButton, { backgroundColor: "#2E7D32", borderRadius: 100 }]} onPress={handleMarkSafe}>
          <Feather name="check" size={22} color="#fff" />
          <Text style={[styles.safeButtonText, { color: "#fff", fontFamily: "Poppins_700Bold" }]}>I am Safe - Stop SOS</Text>
        </Pressable>

        <Text style={[styles.note, { color: "rgba(255,255,255,0.3)", fontFamily: "Poppins_400Regular" }]}>
          Keep this screen open. Audio is being recorded as evidence. Your contacts have been alerted.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, alignItems: "center", gap: 16 },
  alertBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 8 },
  alertBadgeText: { color: "#fff", fontSize: 13, letterSpacing: 1.5 },
  timer: { fontSize: 64, lineHeight: 72 },
  timerLabel: { fontSize: 13, marginTop: -4, marginBottom: 8 },
  card: { width: "100%", padding: 16 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardInfo: { flex: 1, gap: 2 },
  cardLabel: { fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  cardValue: { fontSize: 14 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FF5252" },
  playbackRow: { borderTopWidth: 1, marginTop: 12, paddingTop: 12, gap: 8 },
  playBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10 },
  playBtnText: { color: "#fff", fontSize: 13 },
  progressBarBg: { height: 4, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: 4, borderRadius: 4 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  contactAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  contactInitial: { fontSize: 16 },
  contactName: { fontSize: 14 },
  contactPhone: { fontSize: 12 },
  callBtn: { marginLeft: "auto", padding: 8 },
  safeButton: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18, paddingHorizontal: 40, marginTop: 8, width: "100%", justifyContent: "center" },
  safeButtonText: { fontSize: 18 },
  note: { fontSize: 12, textAlign: "center", lineHeight: 18, paddingHorizontal: 16 },
});
