import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Feather } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    icon: "mic" as const,
    title: "Your voice is\nyour shield",
    body: "Set custom trigger phrases like 'help me' or 'bachao'. NIVARA listens and automatically activates SOS when you need it most.",
  },
  {
    id: "2",
    icon: "users" as const,
    title: "Trusted hands\naround you",
    body: "Add up to 5 emergency contacts. When SOS is triggered, they receive your live location instantly via SMS.",
  },
  {
    id: "3",
    icon: "map-pin" as const,
    title: "Help is always\nnear you",
    body: "Find nearby hospitals, police stations, and ambulances instantly. India emergency numbers are always one tap away.",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateSettings } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = async () => {
    await updateSettings({ onboardingComplete: true });
    router.replace("/(tabs)");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: topPad },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoText}>N</Text>
        </View>
        <Text style={[styles.appName, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>
          NIVARA
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.accentForeground + "15" },
              ]}
            >
              <Feather name={item.icon} size={56} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.slideTitle,
                { color: colors.foreground, fontFamily: "Poppins_700Bold" },
              ]}
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.slideBody,
                { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" },
              ]}
            >
              {item.body}
            </Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === currentIndex ? colors.primary : colors.border,
                width: i === currentIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: botPad + 24 }]}>
        <Pressable
          style={[
            styles.nextButton,
            { backgroundColor: colors.primary, borderRadius: 100 },
          ]}
          onPress={handleNext}
        >
          <Text
            style={[
              styles.nextText,
              { color: colors.primaryForeground, fontFamily: "Poppins_600SemiBold" },
            ]}
          >
            {currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
          </Text>
          <Feather
            name={currentIndex === SLIDES.length - 1 ? "check" : "arrow-right"}
            size={20}
            color={colors.primaryForeground}
          />
        </Pressable>

        {currentIndex < SLIDES.length - 1 && (
          <Pressable onPress={handleGetStarted} style={styles.skipButton}>
            <Text
              style={[
                styles.skipText,
                { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" },
              ]}
            >
              Skip for now
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 10,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
  },
  appName: {
    fontSize: 22,
    letterSpacing: 2,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 24,
  },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  slideTitle: {
    fontSize: 32,
    textAlign: "center",
    lineHeight: 42,
  },
  slideBody: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 26,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 16,
    alignItems: "center",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 17,
    paddingHorizontal: 40,
    width: "100%",
    justifyContent: "center",
  },
  nextText: {
    fontSize: 17,
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
  },
});
