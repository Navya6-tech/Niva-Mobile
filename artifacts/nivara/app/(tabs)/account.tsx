import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "@/hooks/useTranslation";

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
      {title}
    </Text>
  );
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  destructive?: boolean;
}
function Row({ icon, label, sublabel, right, onPress, isLast, destructive }: RowProps) {
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
      <View style={[styles.settingIcon, { backgroundColor: destructive ? colors.destructive + "15" : colors.muted, borderRadius: 10 }]}>
        {icon}
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, { color: destructive ? colors.destructive : colors.foreground, fontFamily: "Poppins_500Medium" }]}>
          {label}
        </Text>
        {sublabel && (
          <Text style={[styles.settingSubLabel, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            {sublabel}
          </Text>
        )}
      </View>
      {right}
    </Pressable>
  );
}

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { settings, contacts, updateSettings, resetAppData } = useApp();
  const [editVisible, setEditVisible] = useState(false);
  const [nameInput, setNameInput] = useState(settings.username || "");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const initial = (settings.username || "N").charAt(0).toUpperCase();

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      await updateSettings({ username: trimmed });
    }
    setEditVisible(false);
  };

  const handleReset = () => {
    Alert.alert(
      t("resetConfirmTitle"),
      t("resetConfirmDesc"),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("resetAppData"), style: "destructive", onPress: () => resetAppData() },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: botPad + 40 }]}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
          {t("tabAccount")}
        </Text>

        <View style={styles.profileHeader}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { fontFamily: "Poppins_700Bold" }]}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              {settings.username || t("guest")}
            </Text>
            <Text style={[styles.profileSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {contacts.length} {t("emergencyContactsLabel")}
            </Text>
          </View>
          <Pressable onPress={() => { setNameInput(settings.username || ""); setEditVisible(true); }} style={[styles.editBtn, { backgroundColor: colors.primary + "15", borderRadius: 10 }]}>
            <Feather name="edit-2" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <SectionHeader title={t("dataPrivacySection")} />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <Row
            icon={<Feather name="shield" size={18} color={colors.mutedForeground} />}
            label={t("privacyNote")}
            sublabel={t("privacyNoteDesc")}
            isLast
          />
        </View>

        <SectionHeader title={t("aboutSection")} />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.border, borderWidth: 1 }]}>
          <Row
            icon={<Feather name="info" size={18} color={colors.mutedForeground} />}
            label="NIVARA"
            sublabel={t("appVersionLabel")}
            isLast
          />
        </View>

        <SectionHeader title={t("dangerZoneSection")} />
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 18, borderColor: colors.destructive + "30", borderWidth: 1 }]}>
          <Row
            icon={<Feather name="trash-2" size={18} color={colors.destructive} />}
            label={t("resetAppData")}
            sublabel={t("resetAppDataDesc")}
            onPress={handleReset}
            isLast
            destructive
          />
        </View>
      </ScrollView>

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: 20 }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
              {t("editUsername")}
            </Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t("yourName")}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.modalInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border, fontFamily: "Poppins_500Medium" }]}
              autoCapitalize="words"
              maxLength={30}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditVisible(false)} style={[styles.modalBtn, { backgroundColor: colors.muted, borderRadius: 12 }]}>
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}>
                  {t("cancel")}
                </Text>
              </Pressable>
              <Pressable onPress={handleSaveName} style={[styles.modalBtn, { backgroundColor: colors.primary, borderRadius: 12 }]}>
                <Text style={[styles.modalBtnText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                  {t("save")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  pageTitle: { fontSize: 24, marginBottom: 4 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 22 },
  profileName: { fontSize: 18 },
  profileSub: { fontSize: 13, marginTop: 2 },
  editBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  sectionHeader: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: -8, marginTop: 4 },
  card: { overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 14 },
  settingIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 15 },
  settingSubLabel: { fontSize: 12, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 32 },
  modalCard: { width: "100%", padding: 24, gap: 16 },
  modalTitle: { fontSize: 18 },
  modalInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15 },
  modalActions: { flexDirection: "row", gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  modalBtnText: { fontSize: 14 },
});
