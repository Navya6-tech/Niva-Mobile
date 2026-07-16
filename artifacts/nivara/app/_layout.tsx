import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { AppState, NativeModules, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";
import "@/tasks/backgroundProtection";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function PendingSosChecker() {
  const { triggerSOS } = useApp();
  useEffect(() => {
    // Check pendingSOS on mount - app may have been launched/reopened due to BG shake.
    // Always route through triggerSOS(true) so SMS is sent reliably (native already handles recording).
    if (Platform.OS === "android") {
      setTimeout(() => {
        try {
          NativeModules.NivaraService?.getAndClearPendingSOS?.().then((pending: boolean) => {
            if (pending) triggerSOS(true);
          }).catch(() => {});
        } catch (e) {}
      }, 1500);
    }
  }, [triggerSOS]);
  return null;
}
function RootLayoutNav({ fontsReady }: { fontsReady: boolean }) {
  const { settings, settingsLoaded } = useApp();
  useEffect(() => {
    // Only hide the native splash once BOTH fonts and settings are ready,
    // so we never flash the wrong initial screen (tabs vs onboarding).
    if (fontsReady && settingsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady, settingsLoaded]);
  if (!settingsLoaded) {
    // Keep native splash visible - render nothing yet
    return null;
  }
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sos-active" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="recordings" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });


  useEffect(() => {
    // Track app foreground/background state globally
    if (Platform.OS === "android") {
      const sub = AppState.addEventListener('change', async state => {
        const inBg = state === 'background' || state === 'inactive';
        try { NativeModules.NivaraService?.setAppForeground?.(!inBg); } catch(e) {}
        if (inBg) {
          // Release expo-av audio session so native MediaRecorder can use mic
          try {
            const { Audio } = require('expo-av');
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false, staysActiveInBackground: false });
          } catch(e) {}
        }

      });
      try { NativeModules.NivaraService?.setAppForeground?.(true); } catch(e) {}
      return () => sub.remove();
    }
  }, []);

  useEffect(() => {
    // Handle notification tap - navigate to SOS screen
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.replace("/sos-active");
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <PendingSosChecker />
            <GestureHandlerRootView>
              
                <RootLayoutNav fontsReady={fontsLoaded || !!fontError} />
              
            </GestureHandlerRootView>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
