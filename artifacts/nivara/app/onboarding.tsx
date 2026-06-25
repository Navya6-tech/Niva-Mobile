import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { requestAllPermissions } from "@/hooks/usePermissions";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    icon: "mic" as const,
    titleEn: "Your voice is\nyour shield",
    titleHi: "आपकी आवाज़\nआपकी ढाल है",
    bodyEn: "Set custom trigger phrases like 'help me' or 'bachao'. NIVARA listens and automatically activates SOS when you need it most.",
    bodyHi: "कस्टम ट्रिगर वाक्यांश जैसे 'मदद करो' या 'बचाओ' सेट करें। NIVARA सुनता है और ज़रूरत पर SOS सक्रिय करता है।",
  },
  {
    id: "2",
    icon: "users" as const,
    titleEn: "Trusted hands\naround you",
    titleHi: "विश्वसनीय लोग\nआपके पास",
    bodyEn: "Add up to 5 emergency contacts. When SOS is triggered, they receive your live location instantly via SMS.",
    bodyHi: "5 आपातकालीन संपर्क जोड़ें। SOS ट्रिगर होने पर उन्हें SMS से आपकी लाइव लोकेशन मिलती है।",
  },
  {
    id: "3",
    icon: "map-pin" as const,
    titleEn: "Help is always\nnear you",
    titleHi: "सहायता हमेशा\nपास है",
    bodyEn: "Find nearby hospitals, police stations, and ambulances instantly. India emergency numbers are always one tap away.",
    bodyHi: "नज़दीकी अस्पताल, पुलिस स्टेशन और एम्बुलेंस तुरंत खोजें। भारत के आपातकालीन नंबर एक टैप पर।",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateSettings, settings } = useApp();
  const [step, setStep] = useState<"language" | "slides" | "permissions">("language");
  const [selectedLang, setSelectedLang] = useState<"en" | "hi">("en");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const lang = settings.language ?? "en";
  const isHi = lang === "hi";

  const handleLangContinue = async () => {
    await updateSettings({ language: selectedLang });
    setStep("slides");
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      setStep("permissions");
    }
  };

  const handleGetStarted = async () => {
    await updateSettings({ onboardingComplete: true });
    router.replace("/(tabs)");
  };

  const handleAllowPermissions = async () => {
    setRequesting(true);
    await requestAllPermissions();
    setRequesting(false);
    await handleGetStarted();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (step === "permissions") {
    const perms = [
      { icon: "bell" as const, labelEn: "Notifications", labelHi: "नोटिफिकेशन", descEn: "Background protection alerts", descHi: "बैकग्राउंड सुरक्षा अलर्ट" },
      { icon: "mic" as const, labelEn: "Microphone", labelHi: "माइक्रोफोन", descEn: "Voice trigger detection", descHi: "वॉइस ट्रिगर डिटेक्शन" },
      { icon: "map-pin" as const, labelEn: "Location", labelHi: "लोकेशन", descEn: "Share with emergency contacts", descHi: "आपातकालीन संपर्कों से साझा करें" },
      { icon: "shield" as const, labelEn: "Background Location", labelHi: "बैकग्राउंड लोकेशन", descEn: "Stay protected when app is minimized", descHi: "ऐप मिनिमाइज़ होने पर भी सुरक्षित रहें" },
    ];

    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>NIVARA</Text>
        </View>

        <View style={styles.permBody}>
          <View style={[styles.permIconCircle, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="shield" size={52} color={colors.primary} />
          </View>
          <Text style={[styles.permTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            {isHi ? "NIVARA को अनुमति दें" : "Allow NIVARA to\nprotect you"}
          </Text>
          <Text style={[styles.permSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            {isHi ? "ये अनुमतियाँ आपकी सुरक्षा के लिए ज़रूरी हैं" : "These permissions are required for your safety"}
          </Text>

          <View style={styles.permList}>
            {perms.map((p) => (
              <View key={p.icon} style={[styles.permRow, { backgroundColor: colors.card, borderRadius: 14 }]}>
                <View style={[styles.permIconBox, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name={p.icon} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.permLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                    {isHi ? p.labelHi : p.labelEn}
                  </Text>
                  <Text style={[styles.permDesc, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                    {isHi ? p.descHi : p.descEn}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: botPad + 24 }]}>
          <Pressable
            style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: 100, opacity: requesting ? 0.7 : 1 }]}
            onPress={handleAllowPermissions}
            disabled={requesting}
          >
            {requesting
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Text style={[styles.nextText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
                    {isHi ? "सभी अनुमतियाँ दें" : "Allow All Permissions"}
                  </Text>
                  <Feather name="check" size={20} color="#fff" />
                </>
            }
          </Pressable>
          <Pressable onPress={handleGetStarted} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {isHi ? "अभी छोड़ें" : "Skip for now"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === "language") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>
            NIVARA
          </Text>
        </View>

        <View style={styles.langBody}>
          <Text style={[styles.langHeading, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            Choose your language{"\n"}अपनी भाषा चुनें
          </Text>

          <View style={styles.langCards}>
            <Pressable
              style={[
                styles.langCard,
                {
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: selectedLang === "en" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedLang("en")}
            >
              <Text style={styles.langFlag}>🇬🇧</Text>
              <Text style={[styles.langName, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                English
              </Text>
              <Text style={[styles.langSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                Continue in English
              </Text>
              {selectedLang === "en" && (
                <View style={[styles.langCheck, { backgroundColor: colors.primary }]}>
                  <Feather name="check" size={14} color="#fff" />
                </View>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.langCard,
                {
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: selectedLang === "hi" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedLang("hi")}
            >
              <Text style={styles.langFlag}>🇮🇳</Text>
              <Text style={[styles.langName, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
                हिंदी
              </Text>
              <Text style={[styles.langSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                हिंदी में जारी रखें
              </Text>
              {selectedLang === "hi" && (
                <View style={[styles.langCheck, { backgroundColor: colors.primary }]}>
                  <Feather name="check" size={14} color="#fff" />
                </View>
              )}
            </Pressable>
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: botPad + 24 }]}>
          <Pressable
            style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: 100 }]}
            onPress={handleLangContinue}
          >
            <Text style={[styles.nextText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
              {selectedLang === "hi" ? "जारी रखें" : "Continue"}
            </Text>
            <Feather name="arrow-right" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
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
            <View style={[styles.iconCircle, { backgroundColor: colors.accentForeground + "15" }]}>
              <Feather name={item.icon} size={56} color={colors.primary} />
            </View>
            <Text style={[styles.slideTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
              {isHi ? item.titleHi : item.titleEn}
            </Text>
            <Text style={[styles.slideBody, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {isHi ? item.bodyHi : item.bodyEn}
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
                backgroundColor: i === currentIndex ? colors.primary : colors.border,
                width: i === currentIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: botPad + 24 }]}>
        <Pressable
          style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: 100 }]}
          onPress={handleNext}
        >
          <Text style={[styles.nextText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
            {currentIndex === SLIDES.length - 1
              ? isHi ? "शुरू करें" : "Get Started"
              : isHi ? "आगे" : "Next"}
          </Text>
          <Feather
            name={currentIndex === SLIDES.length - 1 ? "check" : "arrow-right"}
            size={20}
            color="#fff"
          />
        </Pressable>

        {currentIndex < SLIDES.length - 1 && (
          <Pressable onPress={handleGetStarted} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {isHi ? "अभी छोड़ें" : "Skip for now"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  logoText: { color: "#fff", fontSize: 20, fontFamily: "Poppins_700Bold" },
  appName: { fontSize: 22, letterSpacing: 2 },
  langBody: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 32,
  },
  langHeading: { fontSize: 26, textAlign: "center", lineHeight: 38 },
  langCards: { flexDirection: "row", gap: 16 },
  langCard: {
    flex: 1,
    alignItems: "center",
    padding: 24,
    gap: 8,
    position: "relative",
  },
  langFlag: { fontSize: 40 },
  langName: { fontSize: 20 },
  langSub: { fontSize: 12, textAlign: "center" },
  langCheck: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
  slideTitle: { fontSize: 32, textAlign: "center", lineHeight: 42 },
  slideBody: { fontSize: 16, textAlign: "center", lineHeight: 26 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 32,
  },
  dot: { height: 8, borderRadius: 4 },
  footer: { paddingHorizontal: 24, gap: 16, alignItems: "center" },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 17,
    paddingHorizontal: 40,
    width: "100%",
    justifyContent: "center",
  },
  nextText: { fontSize: 17 },
  skipButton: { paddingVertical: 8 },
  skipText: { fontSize: 14 },
  permBody: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  permIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  permTitle: { fontSize: 26, textAlign: "center", lineHeight: 36 },
  permSub: { fontSize: 14, textAlign: "center", marginBottom: 8 },
  permList: { width: "100%", gap: 10 },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 14,
  },
  permIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  permLabel: { fontSize: 15 },
  permDesc: { fontSize: 12, marginTop: 2 },
});
