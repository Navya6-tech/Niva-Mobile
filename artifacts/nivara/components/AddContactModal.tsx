import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { EmergencyContact } from "@/context/AppContext";

interface AddContactModalProps {
  visible: boolean;
  contact?: EmergencyContact | null;
  onSave: (contact: Omit<EmergencyContact, "id"> & { id?: string }) => void;
  onClose: () => void;
}

export function AddContactModal({
  visible,
  contact,
  onSave,
  onClose,
}: AddContactModalProps) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({ name: "", phone: "" });

  useEffect(() => {
    if (visible) {
      setName(contact?.name ?? "");
      setPhone(contact?.phone ?? "");
      setErrors({ name: "", phone: "" });
    }
  }, [visible, contact]);

  const validate = () => {
    const e = { name: "", phone: "" };
    if (!name.trim()) e.name = "Name is required";
    if (!phone.trim()) e.phone = "Phone number is required";
    else if (!/^[\d\s+\-()]{7,}$/.test(phone.trim())) e.phone = "Enter a valid number";
    setErrors(e);
    return !e.name && !e.phone;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ id: contact?.id, name: name.trim(), phone: phone.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Poppins_700Bold" },
            ]}
          >
            {contact ? "Edit Contact" : "Add Emergency Contact"}
          </Text>

          <Text
            style={[styles.label, { color: colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}
          >
            Full Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Mom, Sister, Friend"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderRadius: 12,
                borderColor: errors.name ? colors.destructive : colors.border,
                fontFamily: "Poppins_400Regular",
              },
            ]}
          />
          {!!errors.name && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {errors.name}
            </Text>
          )}

          <Text
            style={[styles.label, { color: colors.mutedForeground, fontFamily: "Poppins_500Medium" }]}
          >
            Phone Number
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98765 43210"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderRadius: 12,
                borderColor: errors.phone ? colors.destructive : colors.border,
                fontFamily: "Poppins_400Regular",
              },
            ]}
          />
          {!!errors.phone && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {errors.phone}
            </Text>
          )}

          <View style={styles.buttons}>
            <Pressable
              style={[
                styles.btn,
                styles.cancel,
                { backgroundColor: colors.muted, borderRadius: 12 },
              ]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.btnText,
                  { color: colors.foreground, fontFamily: "Poppins_600SemiBold" },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.save,
                { backgroundColor: colors.primary, borderRadius: 12 },
              ]}
              onPress={handleSave}
            >
              <Text
                style={[
                  styles.btnText,
                  { color: colors.primaryForeground, fontFamily: "Poppins_600SemiBold" },
                ]}
              >
                Save Contact
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  error: {
    fontSize: 12,
    marginBottom: 12,
    fontFamily: "Poppins_400Regular",
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  btn: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
  },
  cancel: {},
  save: {},
  btnText: {
    fontSize: 15,
  },
});
