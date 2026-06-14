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
import { useTranslation } from "@/hooks/useTranslation";
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

export default function RecordingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const soundRef = useRef<{ unloadAsync: () => Promise<void>; pauseAsync: () => Promise<void> } | null>(null);

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
    fetchRecordings();
  }, [fetchRecordings]);

  const handleDelete = useCallback((rec: RecordingMeta) => {
    const doDelete = async () => {
      if (playingId === rec.id) {
        await soundRef.current?.unloadAsync();
        soundRef.current = null;
        setPlayingId(null);
      }
      await deleteRecordingById(rec.id);
      fetchRecordings();
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
  }, [playingId, fetchRecordings, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
          {t("recordings")}
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
              {recordings.length === 0 ? t("noRecordingsYet").split(".")[0] : ""}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {t("noRecordingsYet")}
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.autoDeleteNote, { backgroundColor: colors.warning + "15", borderRadius: 12, borderColor: colors.warning + "40", borderWidth: 1 }]}>
              <Feather name="clock" size={14} color={colors.warning} />
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
                        {t("saved")}
                      </Text>
                    </View>
                  )}

                  <View style={styles.recordingMeta}>
                    <View style={[styles.recordingIconWrap, { backgroundColor: colors.primary + "15" }]}>
                      <Feather name="mic" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recordingDate, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                        {formatRecordingDate(rec.date)}
                      </Text>
                      <Text style={[styles.recordingInfo, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
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
                      <View style={[styles.progressBarFill, { backgroundColor: colors.primary, borderRadius: 4, width: `${playProgress * 100}%` }]} />
                    </View>
                  )}

                  <View style={[styles.recordingActions, { borderTopColor: colors.border }]}>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: colors.primary + "15", borderRadius: 10 }]}
                      onPress={() => isPlaying ? handlePause() : handlePlay(rec)}
                    >
                      <Feather name={isPlaying ? "pause" : "play"} size={16} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>
                        {isPlaying ? t("pause") : t("play")}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: rec.keepForever ? colors.primary + "20" : colors.muted, borderRadius: 10 }]}
                      onPress={() => handleKeep(rec)}
                    >
                      <Feather name="bookmark" size={16} color={rec.keepForever ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.actionBtnText, { color: rec.keepForever ? colors.primary : colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
                        {rec.keepForever ? t("saved") : t("keep")}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: colors.destructive + "15", borderRadius: 10 }]}
                      onPress={() => handleDelete(rec)}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                      <Text style={[styles.actionBtnText, { color: colors.destructive, fontFamily: "Poppins_500Medium" }]}>
                        {t("delete")}
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  content: { padding: 20, gap: 16 },
  emptyState: { padding: 40, alignItems: "center", gap: 14, marginTop: 20 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18 },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  autoDeleteNote: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  autoDeleteText: { fontSize: 12, flex: 1 },
  recordingCard: { overflow: "hidden" },
  savedBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginRight: 14, marginTop: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  savedBadgeText: { color: "#fff", fontSize: 10 },
  recordingMeta: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16, paddingBottom: 12 },
  recordingIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  recordingDate: { fontSize: 14 },
  recordingInfo: { fontSize: 12, marginTop: 2 },
  autoDeleteLabel: { fontSize: 11, marginTop: 2 },
  progressBarBg: { height: 4, marginHorizontal: 16, marginBottom: 8 },
  progressBarFill: { height: 4 },
  recordingActions: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  actionBtnText: { fontSize: 13 },
});
