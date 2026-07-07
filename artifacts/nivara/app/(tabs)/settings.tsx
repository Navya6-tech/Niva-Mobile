import React, { useState, useEffect } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "@/hooks/useTranslation";
import { openAccessibilitySettings, isAccessibilityEnabled } from "@/hooks/useNativeBackgroundService";

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
      {title}
    </Text>
  );
}

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}

function SettingRow({ icon, label, sublabel, right, onPress, isLast }: SettingRowProps) {
  const colors = useColors();
  return (
    <Pressable
      style={[
        styles.settingRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.muted, borderRadius: 10 }]}>
        {icon}
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
          {label}
        </Text>
        {sublabel && (
          <Text style={[styles.settingSubLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            {sublabel}
          </Text>
        )}
      </View>
      {right}
      {onPress && !right && (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useApp();
  const { t, lang } = useTranslation();
  const [newPhrase, setNewPhrase] = useState("");
  const [showPhraseInput, setShowPhraseInput] = useState(false);
  const [accessibilityOn, setAccessibilityOn] = useState(false);

  useEffect(() => {
    isAccessibilityEnabled().then(setAccessibilityOn);
  }, []);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const sensitivityLabel = (s: string) => {
    if (lang === "hi") {
      return `${t("sensitivityPrefix")} ${s === "low" ? t("low") : s === "medium" ? t("medium") : t("high")}`;
    }
    return `${t("sensitivityPrefix")} ${s === "low" ? t("low") : s === "medium" ? t("medium") : t("high")}`;
  };

  const addPhrase = async () => {
    const trimmed = newPhrase.trim().toLowerCase();
    if (!trimmed) return;
    if (settings.triggerPhrases.includes(trimmed)) {
      Alert.alert(t("alreadyExists"), t("phraseAlreadyExists"));
      return;
    }
    await updateSettings({ triggerPhrases: [...settings.triggerPhrases, trimmed] });
    setNewPhrase("");
    setShowPhraseInput(false);
  };

  const removePhrase = async (phrase: string) => {
    await updateSettings({
      triggerPhrases: settings.triggerPhrases.filter((p) => p !== phrase),
    });
  };

  const handleBgToggle = (v: boolean) => {
    if (!v) {
      Alert.alert(
        t("bgWarningTitle"),
        t("bgWarning"),
        [
          { text: t("cancel"), style: "cancel" },
          { text: t("confirm"), style: "destructive", onPress: () => updateSettings({ backgroundProtectionEnabled: false }) },
        ]
      );
    } else {
      updateSettings({ backgroundProtectionEnabled: true });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: botPad + 100 },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
          {t("settingsTitle")}
        </Text>

        {/* Language */}
        <SectionHeader title={t("languageSection")} />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.muted, borderRadius: 10 }]}>
              <Feather name="globe" size={18} color={colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                {t("languageLabel")}
              </Text>
            </View>
          </View>
          <View style={styles.langRow}>
            {(["en", "hi"] as const).map((lng) => (
              <Pressable
                key={lng}
                style={[
                  styles.langChip,
                  {
                    backgroundColor: settings.language === lng ? colors.primary : colors.muted,
                    borderRadius: 12,
                  },
                ]}
                onPress={() => updateSettings({ language: lng })}
              >
                <Text style={styles.langFlag}>{lng === "en" ? "🇬🇧" : "🇮🇳"}</Text>
                <Text
                  style={[
                    styles.langChipText,
                    {
                      color: settings.language === lng ? "#fff" : colors.mutedForeground,
                      fontFamily: "Poppins_500Medium",
                    },
                  ]}
                >
                  {lng === "en" ? t("english") : t("hindi")}
                </Text>
                {settings.language === lng && (
                  <Feather name="check" size={14} color="#fff" />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Voice trigger section */}
        <SectionHeader title={t("voiceTrigger").toUpperCase()} />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <SettingRow
            icon={<Feather name="mic" size={18} color={colors.primary} />}
            label={t("voiceTrigger")}
            sublabel={settings.voiceTriggerActive ? t("voiceTriggerOn") : t("voiceTriggerOff")}
            right={
              <Switch
                value={settings.voiceTriggerActive}
                onValueChange={(v) => updateSettings({ voiceTriggerActive: v })}
                trackColor={{ true: colors.primary, false: colors.muted }}
                thumbColor="#fff"
              />
            }
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.phrasesSection}>
            <View style={styles.phrasesHeader}>
              <Text style={[styles.phrasesLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                {t("triggerPhrases")}
              </Text>
              <Pressable onPress={() => setShowPhraseInput(!showPhraseInput)}>
                <Feather name="plus-circle" size={20} color={colors.primary} />
              </Pressable>
            </View>

            <View style={styles.phraseList}>
              {settings.triggerPhrases.map((phrase) => (
                <View
                  key={phrase}
                  style={[styles.phraseChip, { backgroundColor: colors.accentForeground + "15", borderRadius: 100 }]}
                >
                  <Text style={[styles.phraseText, { color: colors.primary, fontFamily: "Poppins_500Medium" }]}>
                    &quot;{phrase}&quot;
                  </Text>
                  <Pressable onPress={() => removePhrase(phrase)}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </View>

            {showPhraseInput && (
              <View style={styles.phraseInputRow}>
                <TextInput
                  value={newPhrase}
                  onChangeText={setNewPhrase}
                  placeholder='e.g. "help me now"'
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.phraseInput,
                    {
                      backgroundColor: colors.input,
                      color: colors.foreground,
                      borderRadius: 10,
                      borderColor: colors.border,
                      fontFamily: "Poppins_400Regular",
                    },
                  ]}
                  onSubmitEditing={addPhrase}
                  returnKeyType="done"
                />
                <Pressable
                  style={[styles.addPhraseBtn, { backgroundColor: colors.primary, borderRadius: 10 }]}
                  onPress={addPhrase}
                >
                  <Feather name="check" size={18} color="#fff" />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* SOS behavior */}
        <SectionHeader title={t("sosBehaviorSection")} />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <SettingRow
            icon={<Feather name="smartphone" size={18} color="#9C27B0" />}
            label={t("shakeToSOS")}
            sublabel={sensitivityLabel(settings.shakeSensitivity)}
            right={null}
            onPress={() => {
              const levels: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
              const next = levels[(levels.indexOf(settings.shakeSensitivity) + 1) % levels.length];
              updateSettings({ shakeSensitivity: next });
            }}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={<Feather name="video-off" size={18} color="#607D8B" />}
            label={t("stealthMode")}
            sublabel={t("stealthModeDesc")}
            isLast
            right={
              <Switch
                value={settings.stealthMode}
                onValueChange={(v) => updateSettings({ stealthMode: v })}
                trackColor={{ true: colors.primary, false: colors.muted }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Check-in timer */}
        <SectionHeader title={t("checkInSection")} />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: colors.muted, borderRadius: 10 }]}>
              <Feather name="clock" size={18} color={colors.warning ?? "#F57C00"} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                {t("defaultDuration")}
              </Text>
              <Text style={[styles.settingSubLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                {settings.checkInDuration} {t("minutes")}
              </Text>
            </View>
          </View>
          <View style={styles.durationRow}>
            {[15, 30, 45, 60, 90, 120].map((min) => (
              <Pressable
                key={min}
                style={[
                  styles.durationChip,
                  {
                    backgroundColor: settings.checkInDuration === min ? colors.primary : colors.muted,
                    borderRadius: 100,
                  },
                ]}
                onPress={() => updateSettings({ checkInDuration: min })}
              >
                <Text
                  style={[
                    styles.durationText,
                    {
                      color: settings.checkInDuration === min ? "#fff" : colors.mutedForeground,
                      fontFamily: "Poppins_500Medium",
                    },
                  ]}
                >
                  {min}m
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Privacy */}
        <SectionHeader title={t("privacySection").toUpperCase()} />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <SettingRow
            icon={<Feather name="mic-off" size={18} color={colors.mutedForeground} />}
            label={t("audioRecordingToggle")}
            sublabel={t("audioRecordingDesc")}
            isLast
            right={
              <Switch
                value={settings.audioRecording}
                onValueChange={(v) => updateSettings({ audioRecording: v })}
                trackColor={{ true: colors.primary, false: colors.muted }}
                thumbColor="#fff"
              />
            }
          />
        </View>
        {/* Background Protection */}
        <SectionHeader title={t("bgSection")} />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.muted, borderRadius: 10 }]}>
              <Feather name="shield" size={18} color={colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                {t("bgToggle")}
              </Text>
              <Text style={[styles.settingSubLabel, { color: settings.backgroundProtectionEnabled ? "#4CAF50" : colors.destructive, fontFamily: "Poppins_500Medium" }]}>
                {settings.backgroundProtectionEnabled ? t("bgActive") : t("bgInactive")}
              </Text>
            </View>
            <Switch
              value={settings.backgroundProtectionEnabled}
              onValueChange={handleBgToggle}
              trackColor={{ true: colors.primary, false: colors.muted }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.bgNote, { backgroundColor: colors.muted + "80" }]}>
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={[styles.bgNoteText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {t("bgNote")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 24, marginBottom: 4 },
  sectionHeader: {
    fontSize: 11, letterSpacing: 1,
    textTransform: "uppercase", marginTop: 4, marginBottom: -4, paddingLeft: 4,
  },
  card: { overflow: "hidden" },
  divider: { height: 1 },
  settingRow: {
    flexDirection: "row", alignItems: "center",
    padding: 14, gap: 12, minHeight: 60,
  },
  settingIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  settingContent: { flex: 1, gap: 2 },
  settingLabel: { fontSize: 14 },
  settingSubLabel: { fontSize: 12 },
  langRow: { flexDirection: "row", gap: 10, padding: 14, paddingTop: 4 },
  langChip: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 8,
  },
  langFlag: { fontSize: 18 },
  langChipText: { fontSize: 14 },
  phrasesSection: { padding: 14, paddingTop: 8, gap: 12 },
  phrasesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  phrasesLabel: { fontSize: 14 },
  phraseList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  phraseChip: {
    flexDirection: "row", alignItems: "center",
    gap: 6, paddingHorizontal: 12, paddingVertical: 6,
  },
  phraseText: { fontSize: 13 },
  phraseInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  phraseInput: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, borderWidth: 1,
  },
  addPhraseBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 14, paddingTop: 0 },
  durationChip: { paddingHorizontal: 14, paddingVertical: 7 },
  durationText: { fontSize: 13 },
  bgNote: {
    flexDirection: "row", gap: 8, padding: 12, alignItems: "flex-start",
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
  },
  bgNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
