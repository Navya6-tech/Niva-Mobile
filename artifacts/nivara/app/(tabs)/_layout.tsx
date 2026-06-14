import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

let isGlassAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const glassEffect = require("expo-glass-effect");
  isGlassAvailable =
    Platform.OS === "ios" &&
    typeof glassEffect?.isLiquidGlassAvailable === "function" &&
    glassEffect.isLiquidGlassAvailable();
} catch {
  isGlassAvailable = false;
}

function NativeTabLayout() {
  const { t } = useTranslation();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NativeTabs, Icon, Label } = require("expo-router/unstable-native-tabs");
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <Icon sf={{ default: "house", selected: "house.fill" }} />
          <Label>{t("tabHome")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="contacts">
          <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
          <Label>{t("tabContacts")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="nearby">
          <Icon sf={{ default: "mappin.circle", selected: "mappin.circle.fill" }} />
          <Label>{t("tabNearby")}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
          <Label>{t("tabSettings")}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  } catch {
    return <ClassicTabLayout />;
  }
}

function ClassicTabLayout() {
  const colors = useColors();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabHome"),
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: t("tabContacts"),
          tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: t("tabNearby"),
          tabBarIcon: ({ color }) => <Feather name="map-pin" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabSettings"),
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isGlassAvailable) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
