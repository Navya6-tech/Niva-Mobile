import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
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
import { useApp, EmergencyContact } from "@/context/AppContext";
import { AddContactModal } from "@/components/AddContactModal";

export default function ContactsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { contacts, addContact, updateContact, deleteContact } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [editContact, setEditContact] = useState<EmergencyContact | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSave = async (
    contact: Omit<EmergencyContact, "id"> & { id?: string }
  ) => {
    if (contact.id) {
      await updateContact(contact as EmergencyContact);
    } else {
      await addContact({ name: contact.name, phone: contact.phone });
    }
    setModalVisible(false);
    setEditContact(null);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleEdit = (contact: EmergencyContact) => {
    setEditContact(contact);
    setModalVisible(true);
  };

  const handleDelete = (contact: EmergencyContact) => {
    if (Platform.OS === "web") {
      deleteContact(contact.id);
      return;
    }
    Alert.alert(
      "Remove Contact",
      `Remove ${contact.name} from emergency contacts?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deleteContact(contact.id),
        },
      ]
    );
  };

  const handleOpenModal = () => {
    if (contacts.length >= 5) {
      Alert.alert(
        "Limit Reached",
        "You can add up to 5 emergency contacts."
      );
      return;
    }
    setEditContact(null);
    setModalVisible(true);
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
        <View style={styles.header}>
          <View>
            <Text
              style={[
                styles.title,
                { color: colors.foreground, fontFamily: "Poppins_700Bold" },
              ]}
            >
              Emergency Contacts
            </Text>
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Poppins_400Regular",
                },
              ]}
            >
              {contacts.length}/5 contacts added
            </Text>
          </View>
          {contacts.length < 5 && (
            <Pressable
              style={[
                styles.addBtn,
                { backgroundColor: colors.primary, borderRadius: 100 },
              ]}
              onPress={handleOpenModal}
            >
              <Feather name="plus" size={20} color="#fff" />
            </Pressable>
          )}
        </View>

        {contacts.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              {
                backgroundColor: colors.card,
                borderRadius: 20,
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: colors.accentForeground + "15" },
              ]}
            >
              <Feather name="users" size={36} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.foreground,
                  fontFamily: "Poppins_600SemiBold",
                },
              ]}
            >
              No contacts yet
            </Text>
            <Text
              style={[
                styles.emptyBody,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Poppins_400Regular",
                },
              ]}
            >
              Add trusted people who will receive your SOS alert with your live
              location.
            </Text>
            <Pressable
              style={[
                styles.emptyBtn,
                { backgroundColor: colors.primary, borderRadius: 12 },
              ]}
              onPress={handleOpenModal}
            >
              <Feather name="user-plus" size={16} color="#fff" />
              <Text
                style={[
                  styles.emptyBtnText,
                  { color: "#fff", fontFamily: "Poppins_600SemiBold" },
                ]}
              >
                Add First Contact
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.contactList}>
            {contacts.map((contact, i) => (
              <View
                key={contact.id}
                style={[
                  styles.contactCard,
                  {
                    backgroundColor: colors.card,
                    borderRadius: 18,
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: colors.primary + (i % 2 === 0 ? "" : "CC") },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { fontFamily: "Poppins_700Bold" },
                    ]}
                  >
                    {contact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.contactInfo}>
                  <Text
                    style={[
                      styles.contactName,
                      {
                        color: colors.foreground,
                        fontFamily: "Poppins_600SemiBold",
                      },
                    ]}
                  >
                    {contact.name}
                  </Text>
                  <Text
                    style={[
                      styles.contactPhone,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Poppins_400Regular",
                      },
                    ]}
                  >
                    {contact.phone}
                  </Text>
                </View>

                <View style={styles.contactActions}>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      { backgroundColor: "#4CAF5020", borderRadius: 12 },
                    ]}
                    onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                  >
                    <Feather name="phone" size={16} color="#4CAF50" />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: colors.accentForeground + "15",
                        borderRadius: 12,
                      },
                    ]}
                    onPress={() => handleEdit(contact)}
                  >
                    <Feather name="edit-2" size={16} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: colors.destructive + "15",
                        borderRadius: 12,
                      },
                    ]}
                    onPress={() => handleDelete(contact)}
                  >
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: colors.accentForeground + "10",
              borderRadius: 16,
              borderColor: colors.primary + "30",
              borderWidth: 1,
            },
          ]}
        >
          <Feather name="info" size={16} color={colors.primary} />
          <Text
            style={[
              styles.infoText,
              { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" },
            ]}
          >
            When SOS is triggered, all contacts receive an SMS with your live
            GPS location automatically.
          </Text>
        </View>
      </ScrollView>

      <AddContactModal
        visible={modalVisible}
        contact={editContact}
        onSave={handleSave}
        onClose={() => {
          setModalVisible(false);
          setEditContact(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 24 },
  subtitle: { fontSize: 13, marginTop: 2 },
  addBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  contactList: { gap: 12 },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 20 },
  contactInfo: { flex: 1, gap: 2 },
  contactName: { fontSize: 15 },
  contactPhone: { fontSize: 13 },
  contactActions: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  emptyState: { padding: 32, alignItems: "center", gap: 12 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18 },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  emptyBtnText: { fontSize: 15 },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
