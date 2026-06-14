import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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

export interface RecordingMeta {
  id: string;
  uri: string;
  date: number;
  durationMs: number;
  size: number;
  keepForever: boolean;
}

const RECORDINGS_KEY = "sos_recordings";
const AUTO_DELETE_MS = 72 * 60 * 60 * 1000;

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function loadRecordings(): Promise<RecordingMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
    if (!raw) return [];
    const all: RecordingMeta[] = JSON.parse(raw);
    const now = Date.now();
    return all.filter((r) => r.keepForever || now - r.date < AUTO_DELETE_MS);
  } catch {
    return [];
  }
}

export async function saveRecordingMeta(meta: RecordingMeta) {
  try {
    const existing = await loadRecordings();
    const updated = [...existing.filter((r) => r.id !== meta.id), meta];
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));
  } catch {}
}

export default function RecordingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<{ unloadAsync: () => Promise<void>; pauseAsync: () => Promise<void>; playAsync: () => Promise<void> } | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const fetchRecordings = useCallback(async () => {
    const list = await loadRecordings();
    list.sort((a, b) => b.date - a.date);
    setRecordings(list);
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const handlePlay = useCallback(async (rec: RecordingMeta) => {
    if (Platform.OS === "web") {
      Alert.alert("Playback", "Audio playback requires a native device.");
      return;
    }
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playingId === rec.id) {
        setPlayingId(null);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Audio } = require("expo-av");
      const { sound } = await Audio.Sound.createAsync(
        { uri: rec.uri },
        { shouldPlay: true },
        (status: { didJustFinish?: boolean }) => {
          if (status.didJustFinish) setPlayingId(null);
        }
      );
      soundRef.current = sound;
      setPlayingId(rec.id);
    } catch {
      Alert.alert("Error", "Could not play this recording.");
    }
  }, [playingId]);

  const handlePause = useCallback(async () => {
    try {
      await soundRef.current?.pauseAsync();
      setPlayingId(null);
    } catch {}
  }, []);

  const handleKeep = useCallback(async (rec: RecordingMeta) => {
    const updated = { ...rec, keepForever: !rec.keepForever };
    await saveRecordingMeta(updated);
    fetchRecordings();
  }, [fetchRecordings]);

  const handleDelete = useCallback((rec: RecordingMeta) => {
    const doDelete = async () => {
      try {
        const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
        if (!raw) return;
        const all: RecordingMeta[] = JSON.parse(raw);
        await AsyncStorage.setItem(
          RECORDINGS_KEY,
          JSON.stringify(all.filter((r) => r.id !== rec.id))
        );
        if (playingId === rec.id) {
          await soundRef.current?.unloadAsync();
          soundRef.current = null;
          setPlayingId(null);
        }
        fetchRecordings();
      } catch {}
    };

    if (Platform.OS === "web") {
      doDelete();
      return;
    }
    Alert.alert(
      "Delete Recording",
      `Delete the recording from ${formatDate(rec.date)}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]
    );
  }, [playingId, fetchRecordings]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
          Audio Recordings
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 40 }]}
      >
        {recordings.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderRadius: 20, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentForeground + "15" }]}>
              <Feather name="mic-off" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              No recordings yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Recordings are saved automatically during an SOS alert.{"\n"}Enable Audio Recording in Settings.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.autoDeleteNote,
                { backgroundColor: colors.warning + "15", borderRadius: 12, borderColor: colors.warning + "40", borderWidth: 1 },
              ]}
            >
              <Feather name="clock" size={14} color={colors.warning} />
              <Text style={[styles.autoDeleteText, { color: colors.warning, fontFamily: "Poppins_400Regular" }]}>
                Recordings auto-delete after 72 hours unless saved
              </Text>
            </View>

            {recordings.map((rec) => {
              const isPlaying = playingId === rec.id;
              return (
                <View
                  key={rec.id}
                  style={[
                    styles.recordingCard,
                    {
                      backgroundColor: colors.card,
                      borderRadius: 18,
                      borderColor: rec.keepForever ? colors.primary + "50" : colors.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  {rec.keepForever && (
                    <View style={[styles.savedBadge, { backgroundColor: colors.primary }]}>
                      <Feather name="bookmark" size={10} color="#fff" />
                      <Text style={[styles.savedBadgeText, { fontFamily: "Poppins_600SemiBold" }]}>
                        Saved
                      </Text>
                    </View>
                  )}

                  <View style={styles.recordingMeta}>
                    <View style={[styles.recordingIconWrap, { backgroundColor: colors.primary + "15" }]}>
                      <Feather name="mic" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recordingDate, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                        {formatDate(rec.date)}
                      </Text>
                      <Text style={[styles.recordingInfo, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                        {formatDuration(rec.durationMs)} · {formatSize(rec.size)}
                      </Text>
                      {!rec.keepForever && (
                        <Text style={[styles.autoDeleteLabel, { color: colors.warning, fontFamily: "Poppins_400Regular" }]}>
                          Auto-deletes in {Math.max(0, Math.ceil((AUTO_DELETE_MS - (Date.now() - rec.date)) / (1000 * 60 * 60)))}h
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={[styles.recordingActions, { borderTopColor: colors.border }]}>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: colors.primary + "15", borderRadius: 10 }]}
                      onPress={() => isPlaying ? handlePause() : handlePlay(rec)}
                    >
                      <Feather name={isPlaying ? "pause" : "play"} size={16} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>
                        {isPlaying ? "Pause" : "Play"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: rec.keepForever ? colors.primary + "20" : colors.muted,
                          borderRadius: 10,
                        },
                      ]}
                      onPress={() => handleKeep(rec)}
                    >
                      <Feather name="bookmark" size={16} color={rec.keepForever ? colors.primary : colors.mutedForeground} />
                      <Text
                        style={[
                          styles.actionBtnText,
                          {
                            color: rec.keepForever ? colors.primary : colors.mutedForeground,
                            fontFamily: "Poppins_500Medium",
                          },
                        ]}
                      >
                        {rec.keepForever ? "Saved" : "Keep"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: colors.destructive + "15", borderRadius: 10 }]}
                      onPress={() => handleDelete(rec)}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                      <Text style={[styles.actionBtnText, { color: colors.destructive, fontFamily: "Poppins_500Medium" }]}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  content: { padding: 20, gap: 16 },
  emptyState: { padding: 40, alignItems: "center", gap: 14, marginTop: 20 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18 },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  autoDeleteNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  autoDeleteText: { fontSize: 12, flex: 1 },
  recordingCard: { overflow: "hidden" },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    marginRight: 14,
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  savedBadgeText: { color: "#fff", fontSize: 10 },
  recordingMeta: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    paddingBottom: 12,
  },
  recordingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingDate: { fontSize: 14 },
  recordingInfo: { fontSize: 12, marginTop: 2 },
  autoDeleteLabel: { fontSize: 11, marginTop: 2 },
  recordingActions: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  actionBtnText: { fontSize: 13 },
});
