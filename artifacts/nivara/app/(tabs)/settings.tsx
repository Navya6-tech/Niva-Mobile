import React, { useState } from "react";
import {
  Alert,
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
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

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
  const [newPhrase, setNewPhrase] = useState("");
  const [showPhraseInput, setShowPhraseInput] = useState(false);
  const [fakeNameEdit, setFakeNameEdit] = useState(false);
  const [fakeName, setFakeName] = useState(settings.fakeCallerName);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const addPhrase = async () => {
    const trimmed = newPhrase.trim().toLowerCase();
    if (!trimmed) return;
    if (settings.triggerPhrases.includes(trimmed)) {
      Alert.alert("Already exists", "This phrase is already in your list.");
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

  const saveFakeName = async () => {
    await updateSettings({ fakeCallerName: fakeName });
    setFakeNameEdit(false);
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
          Settings
        </Text>

        {/* Voice trigger section */}
        <SectionHeader title="VOICE TRIGGER" />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <SettingRow
            icon={<Feather name="mic" size={18} color={colors.primary} />}
            label="Voice Trigger"
            sublabel={settings.voiceTriggerActive ? "Listening for trigger phrases" : "Off — tap to enable"}
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
                Trigger Phrases
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
        <SectionHeader title="SOS BEHAVIOR" />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <SettingRow
            icon={<Feather name="smartphone" size={18} color="#9C27B0" />}
            label="Shake to SOS"
            sublabel={`Sensitivity: ${settings.shakeSensitivity}`}
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
            label="Stealth Mode"
            sublabel="Hide all alerts during SOS"
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
        <SectionHeader title="CHECK-IN TIMER" />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: colors.muted, borderRadius: 10 }]}>
              <Feather name="clock" size={18} color={colors.warning ?? "#F57C00"} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                Default Duration
              </Text>
              <Text style={[styles.settingSubLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                {settings.checkInDuration} minutes
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
                    backgroundColor:
                      settings.checkInDuration === min ? colors.primary : colors.muted,
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

        {/* Fake call */}
        <SectionHeader title="FAKE CALL" />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: colors.muted, borderRadius: 10 }]}>
              <Feather name="phone-incoming" size={18} color="#9C27B0" />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                Caller Name
              </Text>
              {fakeNameEdit ? (
                <View style={styles.fakeNameRow}>
                  <TextInput
                    value={fakeName}
                    onChangeText={setFakeName}
                    style={[
                      styles.fakeNameInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.primary,
                        fontFamily: "Poppins_400Regular",
                      },
                    ]}
                    autoFocus
                  />
                  <Pressable onPress={saveFakeName}>
                    <Feather name="check" size={18} color={colors.primary} />
                  </Pressable>
                </View>
              ) : (
                <Text style={[styles.settingSubLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                  {settings.fakeCallerName}
                </Text>
              )}
            </View>
            {!fakeNameEdit && (
              <Pressable onPress={() => { setFakeName(settings.fakeCallerName); setFakeNameEdit(true); }}>
                <Feather name="edit-2" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Privacy */}
        <SectionHeader title="PRIVACY & RECORDINGS" />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <SettingRow
            icon={<Feather name="mic-off" size={18} color={colors.mutedForeground} />}
            label="Audio Recording"
            sublabel="Record audio during active SOS"
            right={
              <Switch
                value={settings.audioRecording}
                onValueChange={(v) => updateSettings({ audioRecording: v })}
                trackColor={{ true: colors.primary, false: colors.muted }}
                thumbColor="#fff"
              />
            }
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon={<Feather name="headphones" size={18} color={colors.primary} />}
            label="Audio Recordings"
            sublabel="Review and manage saved SOS recordings"
            isLast
            onPress={() => router.push("/recordings")}
          />
        </View>

        <View style={[styles.tagline, { backgroundColor: colors.accentForeground + "10", borderRadius: 16 }]}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoLetter}>N</Text>
          </View>
          <Text style={[styles.taglineText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            NIVARA — Your safety, always within reach.
          </Text>
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
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: -4,
    paddingLeft: 4,
  },
  card: { overflow: "hidden" },
  divider: { height: 1 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    minHeight: 60,
  },
  settingIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  settingContent: { flex: 1, gap: 2 },
  settingLabel: { fontSize: 14 },
  settingSubLabel: { fontSize: 12 },
  phrasesSection: { padding: 14, paddingTop: 8, gap: 12 },
  phrasesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  phrasesLabel: { fontSize: 14 },
  phraseList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  phraseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  phraseText: { fontSize: 13 },
  phraseInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  phraseInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
  },
  addPhraseBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 14,
    paddingTop: 0,
  },
  durationChip: { paddingHorizontal: 14, paddingVertical: 7 },
  durationText: { fontSize: 13 },
  fakeNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fakeNameInput: {
    flex: 1,
    fontSize: 14,
    borderBottomWidth: 1,
    paddingVertical: 2,
  },
  tagline: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: { color: "#fff", fontSize: 16, fontFamily: "Poppins_700Bold" },
  taglineText: { fontSize: 13, flex: 1 },
});
