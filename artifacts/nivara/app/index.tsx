import { Redirect } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// This is the true root route ("/"). It decides, before anything else mounts,
// whether to send the user to onboarding or straight to the tabs. Keeping this
// decision here (instead of inside (tabs)/index.tsx) means the tabs screen and
// all its hooks/effects (including permission requests, background service
// hooks, etc.) never mount at all until we've confirmed onboarding is done.
export default function RootIndex() {
  const colors = useColors();
  const { settings, settingsLoaded } = useApp();

  if (!settingsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (!settings.onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
