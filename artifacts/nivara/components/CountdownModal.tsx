import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface CountdownModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  seconds?: number;
}

export function CountdownModal({
  visible,
  onConfirm,
  onCancel,
  seconds = 10,
}: CountdownModalProps) {
  const colors = useColors();
  const [count, setCount] = useState(seconds);
  const scale = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      setCount(seconds);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    setCount(seconds);

    intervalRef.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onConfirm();
          return 0;
        }
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, seconds, onConfirm, scale]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.background,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: "rgba(211, 47, 47, 0.1)" },
            ]}
          >
            <Text style={styles.alertEmoji}>🚨</Text>
          </View>

          <Text
            style={[
              styles.title,
              { color: colors.destructive, fontFamily: "Poppins_700Bold" },
            ]}
          >
            SOS ACTIVATING
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" },
            ]}
          >
            Emergency alert will be sent in
          </Text>

          <Animated.Text
            style={[
              styles.countdown,
              {
                color: colors.destructive,
                fontFamily: "Poppins_700Bold",
                transform: [{ scale }],
              },
            ]}
          >
            {count}
          </Animated.Text>

          <Pressable
            style={[
              styles.cancelButton,
              { backgroundColor: colors.muted, borderRadius: colors.radius },
            ]}
            onPress={onCancel}
          >
            <Text
              style={[
                styles.cancelText,
                { color: colors.foreground, fontFamily: "Poppins_600SemiBold" },
              ]}
            >
              Cancel — I'm Safe
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  container: {
    width: "100%",
    alignItems: "center",
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  alertEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  countdown: {
    fontSize: 80,
    marginBottom: 32,
    lineHeight: 90,
  },
  cancelButton: {
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
  },
});
