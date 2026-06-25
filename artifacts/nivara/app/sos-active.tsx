import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { useApp } from "@/context/AppContext";

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function formatDateTime(date: Date) {
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  const mo = (date.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

export default function SOSActiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { contacts, sosStartTime, markSafe } = useApp();
  const [elapsed, setElapsed] = useState(0);
  const [locationText, setLocationText] = useState("Getting location...");
  const [smsSent, setSmsSent] = useState(false);
  const [locationLink, setLocationLink] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    getLocationAndSendSOS();

    const interval = setInterval(() => {
      setElapsed(Date.now() - (sosStartTime ?? Date.now()));
    }, 1000);

    return () => clearInterval(interval);
  }, [pulse, sosStartTime]);

  const getLocationAndSendSOS = async () => {
    try {
      if (Platform.OS === "web") {
        setLocationText("Location unavailable on web");
        buildAndSendSMS("0.0000", "0.0000");
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationText("Location permission denied");
        buildAndSendSMS("unknown", "unknown");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      const link = `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      setLocationLink(link);
      setLocationText(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      buildAndSendSMS(latitude.toFixed(6), longitude.toFixed(6));
    } catch {
      setLocationText("Could not get location");
      buildAndSendSMS("unknown", "unknown");
    }
  };

  const buildAndSendSMS = async (lat: string, lng: string) => {
    if (contacts.length === 0) {
      setSmsSent(false);
      return;
    }
    const now = new Date();
    const link =
      lat === "unknown"
        ? "Location unavailable"
        : `https://maps.google.com/?q=${lat},${lng}`;
    const message =
      `🚨 NIVARA EMERGENCY ALERT\n` +
      `I may need help. Please reach me immediately.\n` +
      `📍 My location: ${link}\n` +
      `🕐 Time: ${formatDateTime(now)}\n` +
      `— Sent via NIVARA Safety App`;

    const phones = contacts.map((c) => c.phone);

    if (Platform.OS === "web") {
      setSmsSent(true);
      return;
    }

    try {
      if (Platform.OS === "android") {
        const { PermissionsAndroid } = require("react-native") as typeof import("react-native");
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.SEND_SMS
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setSmsSent(false);
          return;
        }
        const { sendSMS } = require("direct-sms") as { sendSMS: (phones: string[], msg: string) => void };
        sendSMS(phones, message);
        setSmsSent(true);
      } else {
        setSmsSent(false);
      }
    } catch {
      setSmsSent(false);
    }
  };

  const openLocation = () => {
    if (locationLink) Linking.openURL(locationLink);
  };

  const handleMarkSafe = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    markSafe();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: "#1a0000", paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.alertBadge,
            {
              backgroundColor: colors.destructive,
              borderRadius: 100,
              transform: [{ scale: pulse }],
            },
          ]}
        >
          <Feather name="alert-triangle" size={20} color="#fff" />
          <Text style={[styles.alertBadgeText, { fontFamily: "Poppins_700Bold" }]}>
            ALERT ACTIVE
          </Text>
        </Animated.View>

        <Text style={[styles.timer, { color: "#FFFFFF", fontFamily: "Poppins_700Bold" }]}>
          {formatDuration(elapsed)}
        </Text>
        <Text style={[styles.timerLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>
          SOS active duration
        </Text>

        <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
          <View style={styles.cardRow}>
            <Feather name="map-pin" size={18} color={colors.secondary} />
            <View style={styles.cardInfo}>
              <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>
                Live Location
              </Text>
              <Text style={[styles.cardValue, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>
                {locationText}
              </Text>
            </View>
            {locationLink && (
              <Pressable onPress={openLocation}>
                <Feather name="external-link" size={18} color={colors.secondary} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
          <View style={styles.cardRow}>
            <Feather name="message-circle" size={18} color={smsSent ? "#4CAF50" : colors.secondary} />
            <View style={styles.cardInfo}>
              <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>
                Alert SMS
              </Text>
              <Text style={[styles.cardValue, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>
                {smsSent
                  ? `Sent to ${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`
                  : contacts.length === 0
                  ? "No contacts added"
                  : "Sending..."}
              </Text>
            </View>
            {smsSent && <Feather name="check-circle" size={18} color="#4CAF50" />}
          </View>
        </View>

        {contacts.length > 0 && (
          <View style={[styles.card, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16 }]}>
            <Text style={[styles.cardLabel, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular", marginBottom: 12 }]}>
              Emergency Contacts Alerted
            </Text>
            {contacts.map((c) => (
              <View key={c.id} style={styles.contactRow}>
                <View
                  style={[
                    styles.contactAvatar,
                    { backgroundColor: colors.primary + "40" },
                  ]}
                >
                  <Text style={[styles.contactInitial, { color: colors.secondary, fontFamily: "Poppins_700Bold" }]}>
                    {c.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.contactName, { color: "#fff", fontFamily: "Poppins_500Medium" }]}>
                    {c.name}
                  </Text>
                  <Text style={[styles.contactPhone, { color: "rgba(255,255,255,0.5)", fontFamily: "Poppins_400Regular" }]}>
                    {c.phone}
                  </Text>
                </View>
                <Pressable
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${c.phone}`)}
                >
                  <Feather name="phone" size={16} color="#4CAF50" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={[
            styles.safeButton,
            { backgroundColor: "#2E7D32", borderRadius: 100 },
          ]}
          onPress={handleMarkSafe}
        >
          <Feather name="check" size={22} color="#fff" />
          <Text style={[styles.safeButtonText, { color: "#fff", fontFamily: "Poppins_700Bold" }]}>
            I'm Safe — Stop SOS
          </Text>
        </Pressable>

        <Text style={[styles.note, { color: "rgba(255,255,255,0.3)", fontFamily: "Poppins_400Regular" }]}>
          Keep this screen open. Your contacts have been alerted and can see your location.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  alertBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 8,
  },
  alertBadgeText: {
    color: "#fff",
    fontSize: 13,
    letterSpacing: 1.5,
  },
  timer: {
    fontSize: 64,
    lineHeight: 72,
  },
  timerLabel: {
    fontSize: 13,
    marginTop: -4,
    marginBottom: 8,
  },
  card: {
    width: "100%",
    padding: 16,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cardValue: {
    fontSize: 14,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInitial: {
    fontSize: 16,
  },
  contactName: {
    fontSize: 14,
  },
  contactPhone: {
    fontSize: 12,
  },
  callBtn: {
    marginLeft: "auto",
    padding: 8,
  },
  safeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 40,
    marginTop: 8,
    width: "100%",
    justifyContent: "center",
  },
  safeButtonText: {
    fontSize: 18,
  },
  note: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
