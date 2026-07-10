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
import { AppProvider } from "@/context/AppContext";
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

function RootLayoutNav() {
  return (
    <Stack>
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
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      // Check if app was opened due to background SOS trigger
      if (Platform.OS === "android") {
        try {
          NativeModules.NivaraService?.getAndClearPendingSOS?.().then((pending: boolean) => {
            if (pending) router.push("/sos-active");
          }).catch(() => {});
        } catch (e) {}
      }
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Track app foreground/background state globally
    if (Platform.OS === "android") {
      const sub = AppState.addEventListener('change', state => {
        const inBg = state === 'background' || state === 'inactive';
        try { NativeModules.NivaraService?.setAppForeground?.(!inBg); } catch(e) {}
      });
      try { NativeModules.NivaraService?.setAppForeground?.(true); } catch(e) {}
      return () => sub.remove();
    }
  }, []);

  useEffect(() => {
    // Handle notification tap - navigate to SOS screen
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push("/sos-active");
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <GestureHandlerRootView>
              
                <RootLayoutNav />
              
            </GestureHandlerRootView>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
