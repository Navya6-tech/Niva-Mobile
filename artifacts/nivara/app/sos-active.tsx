import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { saveRecordingMeta } from "@/utils/recordings";
import * as FileSystem from "expo-file-system";

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
}

function formatDateTime(date) {
  return String(date.getHours()).padStart(2,"0") + ":" + String(date.getMinutes()).padStart(2,"0") + " " +
    String(date.getDate()).padStart(2,"0") + "/" + String(date.getMonth()+1).padStart(2,"0") + "/" + date.getFullYear();
}

export default function SOSActiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { contacts, sosStartTime, markSafe } = useApp();
  const [elapsed, setElapsed] = useState(0);
  const [locationText, setLocationText] = useState("Getting location...");
  const [smsState, setSmsState] = useState("idle");
  const [smsError, setSmsError] = useState(null);
  const [locationLink, setLocationLink] = useState(null);
  const lastLatLng = useRef(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const recordingRef = useRef(null);
  const recordingUriRef = useRef(null);
  const [recordingState, setRecordingState] = useState("idle");
  const [recordingUri, setRecordingUri] = useState(null);
  const recordingMsRef = useRef(0);
  const [recordingMs, setRecordingMs] = useState(0);
  const recordingInterval = useRef(null);
  const recordingStart = useRef(null);
  const isStopping = useRef(false);

  const soundRef = useRef(null);
  const [playState, setPlayState] = useState("idle");
  const [playProgress, setPlayProgress] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.05, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
    ])).start();


    // Check native recording status
    const checkRecording = setInterval(async () => {
      try {
        const isRec = await NativeModules.NivaraService?.isBackgroundRecording?.();
        if (isRec) setRecordingState("recording");
      } catch (e) {}
    }, 2000);
    const interval = setInterval(() => setElapsed(Date.now() - (sosStartTime ?? Date.now())), 1000);

    return () => {
      clearInterval(checkRecording);
      clearInterval(interval);
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    if (Platform.OS === "web") return;
    setRecordingState("requesting");
    try {
      // Force release any existing audio session
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false });
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {}

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setRecordingState("error");
        Alert.alert("Microphone Permission Required", "NIVARA needs mic access to record evidence during SOS.", [
          { text: "Open Settings", onPress: () => Linking.openSettings() },
          { text: "Skip", style: "cancel" },
        ]);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
        shouldDuckAndroid: false,
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
      console.error("Recording start error:", e);
      setRecordingState("error");
      // Retry once after 2s
      setTimeout(() => {
        if (recordingRef.current === null) startRecording();
      }, 2000);
    }
  };

  const stopRecordingInternal = async () => {
    if (!recordingRef.current || isStopping.current) return recordingUriRef.current;
    isStopping.current = true;
    try {
      if (recordingInterval.current) { clearInterval(recordingInterval.current); recordingInterval.current = null; }
      const rec = recordingRef.current;
      recordingRef.current = null;
      await rec.stopAndUnloadAsync();
      const tempUri = rec.getURI();
      if (tempUri) {
        try {
          const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          const permanentUri = FileSystem.documentDirectory + "sos_" + id + ".m4a";          await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
          const info = await FileSystem.getInfoAsync(permanentUri, { size: true });
          const size = (info.size ?? 0);
          const durationMs = recordingMsRef.current || (Date.now() - (recordingStart.current ?? Date.now()));
          await saveRecordingMeta({
            id,
            uri: permanentUri,
            date: Date.now(),
            durationMs,
            size,
            keepForever: false,
          });
          recordingUriRef.current = permanentUri;
          setRecordingUri(permanentUri);
          setRecordingState("stopped");
          return permanentUri;
        } catch (copyErr) {          // Fallback: save original temp URI directly
          try {
            const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            const durationMs = recordingMsRef.current || (Date.now() - (recordingStart.current ?? Date.now()));
            await saveRecordingMeta({ id, uri: tempUri, date: Date.now(), durationMs, size: 0, keepForever: false });            recordingUriRef.current = tempUri;
            setRecordingUri(tempUri);
            setRecordingState("stopped");
            return tempUri;
          } catch (fallbackErr) {          }
        }
      } else {      }
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
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (status) => {
        if (status.isLoaded && status.durationMillis) setPlayProgress((status.positionMillis ?? 0) / status.durationMillis);
        if (status.isLoaded && status.didJustFinish) { setPlayState("idle"); setPlayProgress(0); }
      });
      soundRef.current = sound;
      setPlayState("playing");
    } catch (e) { Alert.alert("Error", "Could not play recording: " + e.message); }
  };

  const handlePause = async () => { try { await soundRef.current?.pauseAsync(); setPlayState("paused"); } catch (e) {} };
  const handleResume = async () => { try { await soundRef.current?.playAsync(); setPlayState("playing"); } catch (e) {} };

  const buildAndSendSMS = async (lat, lng) => {
    if (contacts.length === 0) return;
    setSmsState("sending");
    const link = lat === "unknown" ? "Location unavailable" : "https://maps.google.com/?q=" + lat + "," + lng;
    const message = "NIVARA EMERGENCY ALERT\nI may need help. Please reach me immediately.\nMy location: " + link + "\nTime: " + formatDateTime(new Date()) + "\nSent via NIVARA Safety App";
    const phones = contacts.map(c => c.phone);
    if (Platform.OS === "web") { setSmsState("sent"); return; }
    if (Platform.OS !== "android") { setSmsState("failed"); return; }
    try {
      const { PermissionsAndroid } = require("react-native");
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) { setSmsState("denied"); setSmsError("Permission: " + granted); return; }
      const { sendSMS } = require("direct-sms");
      sendSMS(phones, message);
      setSmsState("sent"); setSmsError(null);
    } catch (e) { setSmsState("failed"); setSmsError(e.message || String(e)); }
  };

  const openLocation = () => { if (locationLink) Linking.openURL(locationLink); };

  const handleMarkSafe = () => {
    // Call markSafe immediately - don't await anything that could block
    markSafe();
    // Do cleanup async without blocking UI
    (async () => {
      try { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      try { await Promise.race([stopRecordingInternal(), new Promise(r => setTimeout(r, 2000))]); } catch (e) {}
      try { await soundRef.current?.unloadAsync(); soundRef.current = null; } catch (e) {}
      try {
        // Stop native recording and save metadata
        const filePath = await Promise.race([
          NativeModules.NivaraService?.stopBackgroundRecording?.() ?? Promise.resolve(null),
          new Promise(resolve => setTimeout(() => resolve(null), 2000))
        ]);
        if (filePath) {
          await saveRecordingMeta({
            uri: 'file://' + filePath,
            duration: Date.now() - (sosStartTime ?? Date.now()),
            date: new Date().toISOString(),
            kept: false,
          });
        }
        // Also save JS recording if it happened
        if (recordingUriRef.current && recordingUriRef.current !== ('file://' + filePath)) {
          await saveRecordingMeta({
            uri: recordingUriRef.current,
            duration: recordingMsRef.current || 0,
            date: new Date().toISOString(),
            kept: false,
          });
        }
      } catch (e) {}

    })();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const uri = recordingUri || recordingUriRef.current;

  return (
    <View style={[styles.container, { backgroundColor: "#1a0000", paddingTop: topPad }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.alertBadge, { backgroundColor: colors.destructive, borderRadius: 100, transform: [{ scale: pulse }] }]}>
          <Feather name="alert-triangle" size={20} color="#fff" />
          <Text style={[styles.alertBadgeText, { fontFamily: "Poppins_700Bold" }]}>ALERT ACTIVE</Text>
        </Animated.View>

        <Text style={[styles.timer, { color: "#FFFFFF", fontFamily: "Poppins_700Bold" }]}>{formatDuration(elapsed)}</Text>
        <Text style={[styles.timerLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>SOS active duration</Text>

        <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
          <View style={styles.cardRow}>
            <Feather name="mic" size={18} color={recordingState === "recording" ? "#FF5252" : recordingState === "stopped" ? "#4CAF50" : "rgba(255,255,255,0.4)"} />
            <View style={styles.cardInfo}>
              <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>Audio Recording</Text>
              <Text style={[styles.cardValue, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>
                {recordingState === "requesting" ? "Starting recorder..." :
                 recordingState === "recording" ? "Recording " + formatDuration(recordingMs) :
                 recordingState === "stopped" ? "Evidence saved ✓" :
                 recordingState === "error" ? "Mic unavailable - retrying..." : "Initializing..."}
              </Text>
            </View>
            {recordingState === "recording" && <View style={styles.recDot} />}
            {recordingState === "stopped" && <Feather name="check-circle" size={18} color="#4CAF50" />}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
          <View style={styles.cardRow}>
            <Feather name="map-pin" size={18} color={colors.secondary} />
            <View style={styles.cardInfo}>
              <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>Live Location</Text>
              <Text style={[styles.cardValue, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>{locationText}</Text>
            </View>
            {locationLink && <Pressable onPress={openLocation}><Feather name="external-link" size={18} color={colors.secondary} /></Pressable>}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
          <View style={styles.cardRow}>
            <Feather name="message-circle" size={18} color={smsState === "sent" ? "#4CAF50" : smsState === "denied" || smsState === "failed" ? "#FF5252" : colors.secondary} />
            <View style={styles.cardInfo}>
              <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>Alert SMS</Text>
              <Text style={[styles.cardValue, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>
                {smsState === "sent" ? "Sent to " + contacts.length + " contact" + (contacts.length !== 1 ? "s" : "") :
                 smsState === "sending" ? "Sending..." :
                 smsState === "denied" ? "Permission denied - tap to retry" :
                 smsState === "failed" ? "Failed - tap to retry" :
                 contacts.length === 0 ? "No contacts added" : "Waiting..."}
              </Text>
              {smsError != null && <Text style={{ color: "#FF5252", fontSize: 10, fontFamily: "Poppins_400Regular", marginTop: 4 }}>{smsError}</Text>}
            </View>
            {smsState === "sent" && <Feather name="check-circle" size={18} color="#4CAF50" />}
            {(smsState === "failed" || smsState === "denied") && (
              <Pressable onPress={() => { const ll = lastLatLng.current; buildAndSendSMS(ll ? ll.lat : "unknown", ll ? ll.lng : "unknown"); }}>
                <Feather name="refresh-cw" size={18} color="#FF5252" />
              </Pressable>
            )}
          </View>
        </View>

        {contacts.length > 0 && (
          <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
            <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular", marginBottom: 12 }]}>Emergency Contacts Alerted</Text>
            {contacts.map(c => (
              <View key={c.id} style={styles.contactRow}>
                <View style={[styles.contactAvatar, { backgroundColor: colors.primary + "40" }]}>
                  <Text style={[styles.contactInitial, { color: colors.secondary, fontFamily: "Poppins_700Bold" }]}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={[styles.contactName, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>{c.name}</Text>
                  <Text style={[styles.contactPhone, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>{c.phone}</Text>
                </View>
                <Pressable style={styles.callBtn} onPress={() => Linking.openURL("tel:" + c.phone)}>
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
          Keep this screen open. Audio is being recorded as evidence.
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
