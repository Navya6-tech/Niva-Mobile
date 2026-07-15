import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
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
  AUTO_DELETE_MS,
} from "@/utils/recordings";

let useFocusEffectSafe: any = (_cb: () => void) => {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  useFocusEffectSafe = require("expo-router").useFocusEffect;
  if (typeof useFocusEffectSafe !== "function") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    useFocusEffectSafe = require("@react-navigation/native").useFocusEffect;
  }
} catch {
  useFocusEffectSafe = (_cb: () => void) => {};
}

export default function RecordingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const soundRef = useRef<{ unloadAsync: () => Promise<void>; pauseAsync: () => Promise<void> } | null>(null);

  const refresh = useCallback(async () => {
    const list = await loadRecordings();
    list.sort((a, b) => b.date - a.date);
    setRecordings(list);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffectSafe(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onPullToRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

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
      try {
        const { NativeModules } = require("react-native");
        NativeModules.NivaraService?.prepareAudioForPlayback?.();
      } catch (e) {}
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (e) {}
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
    } catch (e: any) {
      Alert.alert("Error", "Could not play this recording. " + (e?.message || String(e)));
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
    refresh();
  }, [refresh]);

  const handleDeleteRecording = useCallback((rec: RecordingMeta) => {
    const doDelete = async () => {
      if (playingId === rec.id) {
        await soundRef.current?.unloadAsync();
        soundRef.current = null;
        setPlayingId(null);
      }
      await deleteRecordingById(rec.id);
      refresh();
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} tintColor={colors.primary} />
        }
      >
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
                        {formatRecordingDuration(rec.durationMs)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  recordingsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
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
