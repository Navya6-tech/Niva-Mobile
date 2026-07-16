import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const { updateSettings, settings, contacts, addContact } = useApp();
  const [step, setStep] = useState<"language" | "slides" | "username" | "disclaimer" | "contacts" | "permissions" | "terms">("language");
  const [selectedLang, setSelectedLang] = useState<"en" | "hi">("en");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [termsChecked, setTermsChecked] = useState(false);

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
      setStep("username");
    }
  };

  const handleGetStarted = async () => {
    await updateSettings({ onboardingComplete: true });
    router.replace("/(tabs)");
  };

  const handleUsernameContinue = async () => {
    const name = usernameInput.trim();
    await updateSettings({ username: name || (isHi ? "मित्र" : "Friend") });
    setStep("disclaimer");
  };

  const handleDisclaimerContinue = () => {
    setStep("contacts");
  };

  const handleAddContact = async () => {
    const name = contactName.trim();
    const phone = contactPhone.trim();
    if (!name || !phone) return;
    await addContact({ name, phone });
    setContactName("");
    setContactPhone("");
  };

  const handleContactsContinue = () => {
    setStep("permissions");
  };

  const handleTermsAccept = async () => {
    await updateSettings({ termsAccepted: true });
    await handleGetStarted();
  };

  const handleAllowPermissions = async () => {
    setRequesting(true);
    await requestAllPermissions();
    setRequesting(false);
    setStep("terms");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;


  if (step === "username") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}
      >
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>NIVARA</Text>
        </View>
        <View style={styles.permBody}>
          <View style={[styles.permIconCircle, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="user" size={52} color={colors.primary} />
          </View>
          <Text style={[styles.permTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            {isHi ? "आपका नाम क्या है?" : "What should we\ncall you?"}
          </Text>
          <Text style={[styles.permSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            {isHi ? "यह सिर्फ आपके डिवाइस पर संग्रहीत है" : "This is only stored on your device"}
          </Text>
          <TextInput
            value={usernameInput}
            onChangeText={setUsernameInput}
            placeholder={isHi ? "आपका नाम" : "Your name"}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, fontFamily: "Poppins_500Medium" }]}
            autoCapitalize="words"
            maxLength={30}
          />
        </View>
        <View style={[styles.footer, { paddingBottom: botPad + 24 }]}>
          <Pressable
            style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: 100 }]}
            onPress={handleUsernameContinue}
          >
            <Text style={[styles.nextText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
              {isHi ? "जारी रखें" : "Continue"}
            </Text>
            <Feather name="arrow-right" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === "disclaimer") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>NIVARA</Text>
        </View>
        <View style={styles.permBody}>
          <View style={[styles.permIconCircle, { backgroundColor: colors.warning + "18" }]}>
            <Feather name="alert-triangle" size={52} color={colors.warning} />
          </View>
          <Text style={[styles.permTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            {isHi ? "जारी रखने से पहले" : "Before You\nContinue"}
          </Text>
          <Text style={[styles.disclaimerBody, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            {isHi
              ? "NIVARA आपातकालीन सेवाओं को कॉल करने का विकल्प नहीं है। तत्काल खतरे में, यदि संभव हो तो सीधे 112 पर कॉल करें। NIVARA आपके भरोसेमंद संपर्कों को सचेत करने और सबूत रिकॉर्ड करने में मदद करता है।"
              : "NIVARA supplements but does not replace calling emergency services directly. In immediate danger, call 112 (India's emergency number) directly if you can. NIVARA helps alert your trusted contacts and record evidence."}
          </Text>
        </View>
        <View style={[styles.footer, { paddingBottom: botPad + 24 }]}>
          <Pressable
            style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: 100 }]}
            onPress={handleDisclaimerContinue}
          >
            <Text style={[styles.nextText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
              {isHi ? "मैं समझता/समझती हूं" : "I Understand"}
            </Text>
            <Feather name="check" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === "contacts") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}
      >
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>NIVARA</Text>
        </View>
        <ScrollView style={styles.contactsScroll} contentContainerStyle={styles.contactsScrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.permIconCircle, { backgroundColor: colors.primary + "15", alignSelf: "center" }]}>
            <Feather name="users" size={52} color={colors.primary} />
          </View>
          <Text style={[styles.permTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold", textAlign: "center" }]}>
            {isHi ? "आपातकालीन संपर्क जोड़ें" : "Add Emergency\nContacts"}
          </Text>
          <Text style={[styles.permSub, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular", textAlign: "center" }]}>
            {isHi ? "SOS को किसी को सचेत करने के लिए कम से कम एक संपर्क चाहिए" : "At least one contact is needed so SOS can alert someone"}
          </Text>
          <TextInput
            value={contactName}
            onChangeText={setContactName}
            placeholder={isHi ? "नाम" : "Name"}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, fontFamily: "Poppins_500Medium", marginTop: 20 }]}
          />
          <TextInput
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder={isHi ? "फोन नंबर" : "Phone number"}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            style={[styles.textInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, fontFamily: "Poppins_500Medium", marginTop: 12 }]}
          />
          <Pressable
            style={[styles.addContactBtn, { backgroundColor: colors.primary + "15", borderRadius: 12, marginTop: 12 }]}
            onPress={handleAddContact}
          >
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={[styles.addContactBtnText, { color: colors.primary, fontFamily: "Poppins_600SemiBold" }]}>
              {isHi ? "संपर्क जोड़ें" : "Add Contact"}
            </Text>
          </Pressable>
          {contacts.length > 0 && (
            <View style={{ marginTop: 20, gap: 8, width: "100%" }}>
              {contacts.map((c) => (
                <View key={c.id} style={[styles.contactChip, { backgroundColor: colors.card, borderRadius: 12, borderColor: colors.border, borderWidth: 1 }]}>
                  <Feather name="user" size={16} color={colors.primary} />
                  <Text style={[styles.contactChipText, { color: colors.foreground, fontFamily: "Poppins_500Medium" }]}>
                    {c.name} — {c.phone}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: botPad + 24 }]}>
          <Pressable
            style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: 100 }]}
            onPress={() => {
              if (contacts.length === 0) {
                Alert.alert(
                  isHi ? "कोई संपर्क नहीं जोड़ा गया" : "No contact added",
                  isHi ? "बिना संपर्क के, SOS ट्रिगर होने पर किसी को सचेत नहीं करेगा। फिर भी जारी रखें?" : "Without a contact, SOS won't be able to alert anyone when triggered. Continue anyway?",
                  [
                    { text: isHi ? "रद्द करें" : "Cancel", style: "cancel" },
                    { text: isHi ? "जारी रखें" : "Continue Anyway", onPress: handleContactsContinue },
                  ]
                );
              } else {
                handleContactsContinue();
              }
            }}
          >
            <Text style={[styles.nextText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
              {isHi ? "जारी रखें" : "Continue"}
            </Text>
            <Feather name="arrow-right" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === "permissions") {
    const perms = [
      { icon: "bell" as const, labelEn: "Notifications", labelHi: "नोटिफिकेशन", descEn: "Background protection alerts", descHi: "बैकग्राउंड सुरक्षा अलर्ट" },
      { icon: "mic" as const, labelEn: "Microphone", labelHi: "माइक्रोफोन", descEn: "Voice trigger detection", descHi: "वॉइस ट्रिगर डिटेक्शन" },
      { icon: "map-pin" as const, labelEn: "Location", labelHi: "लोकेशन", descEn: "Share with emergency contacts", descHi: "आपातकालीन संपर्कों से साझा करें" },
      { icon: "shield" as const, labelEn: "Background Location", labelHi: "बैकग्राउंड लोकेशन", descEn: "Stay protected when app is minimized", descHi: "ऐप मिनिमाइज़ होने पर भी सुरक्षित रहें" },
      { icon: "message-square" as const, labelEn: "SMS", labelHi: "एसएमएस", descEn: "Send emergency texts to your contacts", descHi: "आपके संपर्कों को आपातकालीन संदेश भेजें" },
    ];

    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>NIVARA</Text>
        </View>

        <ScrollView style={styles.permBodyScroll} contentContainerStyle={styles.permBodyContent} showsVerticalScrollIndicator={false}>
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
          <View style={[styles.batteryNote, { backgroundColor: colors.warning + "12", borderRadius: 14, borderColor: colors.warning + "35", borderWidth: 1 }]}>
            <Feather name="battery-charging" size={18} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.batteryNoteTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                {isHi ? "बैटरी सेटिंग सेट करें" : "One more step: Battery settings"}
              </Text>
              <Text style={[styles.batteryNoteText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
                {isHi
                  ? "SOS ट्रिगर होने पर संदेश तुरंत भेजने और खतरे में चुपचाप सक्रिय होने के लिए, कृपया NIVARA की बैटरी सेटिंग में जाकर उसे \"अप्रतिबंधित\" (Unrestricted) पर सेट करें।"
                  : "So NIVARA can send texts instantly and trigger silently when you're in danger, please set its battery usage to \"Unrestricted\" in your phone settings."}
              </Text>
              <Pressable onPress={() => Linking.openSettings()} style={styles.batteryNoteBtn}>
                <Text style={[styles.batteryNoteBtnText, { color: colors.warning, fontFamily: "Poppins_600SemiBold" }]}>
                  {isHi ? "सेटिंग्स खोलें →" : "Open Settings →"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

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
          <Pressable onPress={() => setStep("terms")} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              {isHi ? "अभी छोड़ें" : "Skip for now"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }


  if (step === "terms") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>NIVARA</Text>
        </View>
        <ScrollView style={styles.termsScroll} contentContainerStyle={styles.termsScrollContent}>
          <Text style={[styles.permTitle, { color: colors.foreground, fontFamily: "Poppins_700Bold", fontSize: 22, textAlign: "left" }]}>
            {isHi ? "नियम और शर्तें" : "Terms & Conditions"}
          </Text>
          <Text style={[styles.termsText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            {isHi
              ? "NIVARA का उपयोग करके, आप सहमत होते हैं कि:\n\n• NIVARA आपातकालीन सेवाओं (पुलिस, एम्बुलेंस) को कॉल करने का विकल्प नहीं है। तत्काल खतरे में सीधे 112 पर कॉल करें।\n\n• आपका डेटा — संपर्क, सेटिंग्स, और रिकॉर्डिंग — केवल आपके डिवाइस पर संग्रहीत है और कहीं अपलोड नहीं किया जाता।\n\n• SOS ट्रिगर होने पर, NIVARA आपके द्वारा जोड़े गए संपर्कों को आपकी लोकेशन के साथ एक टेक्स्ट संदेश भेजने का प्रयास करेगा और ऑडियो सबूत रिकॉर्ड करेगा।\n\n• विश्वसनीय संचालन के लिए ऐप को स्थान, माइक्रोफोन, एसएमएस और बैटरी अप्रतिबंध जैसी अनुमतियों की आवश्यकता है।\n\n• NIVARA अपनी सर्वश्रेष्ठ कोशिश करता है लेकिन डिवाइस, नेटवर्क, या ऑपरेटिंग सिस्टम की सीमाओं के कारण 100% विश्वसनीयता की गारंटी नहीं दे सकता।"
              : "By using NIVARA, you agree that:\n\n• NIVARA is not a substitute for calling emergency services (police, ambulance) directly. In immediate danger, call 112 directly.\n\n• Your data — contacts, settings, and recordings — is stored only on your device and is never uploaded anywhere.\n\n• When SOS is triggered, NIVARA will attempt to text your added contacts with your location and record audio evidence.\n\n• The app needs permissions like location, microphone, SMS, and unrestricted battery usage to work reliably.\n\n• NIVARA does its best but cannot guarantee 100% reliability due to device, network, or OS limitations beyond our control."}
          </Text>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: botPad + 24 }]}>
          <Pressable
            style={styles.termsCheckRow}
            onPress={() => setTermsChecked(!termsChecked)}
          >
            <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: termsChecked ? colors.primary : "transparent" }]}>
              {termsChecked && <Feather name="check" size={14} color="#fff" />}
            </View>
            <Text style={[styles.termsCheckText, { color: colors.foreground, fontFamily: "Poppins_400Regular" }]}>
              {isHi ? "मैं नियम और शर्तों से सहमत हूं" : "I agree to the Terms & Conditions"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: 100, opacity: termsChecked ? 1 : 0.5 }]}
            onPress={handleTermsAccept}
            disabled={!termsChecked}
          >
            <Text style={[styles.nextText, { color: "#fff", fontFamily: "Poppins_600SemiBold" }]}>
              {isHi ? "सहमत हों और जारी रखें" : "Agree & Continue"}
            </Text>
            <Feather name="check" size={20} color="#fff" />
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
          <Pressable onPress={() => setStep("username")} style={styles.skipButton}>
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
  permBodyScroll: { flex: 1, width: "100%" },
  permBodyContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: "center",
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
  textInput: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 16,
  },
  disclaimerBody: { fontSize: 15, textAlign: "center", lineHeight: 24 },
  contactsScroll: { flex: 1, width: "100%" },
  contactsScrollContent: { paddingHorizontal: 24, alignItems: "center", paddingTop: 20 },
  addContactBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    width: "100%",
  },
  addContactBtnText: { fontSize: 14 },
  contactChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  contactChipText: { fontSize: 13, flex: 1 },
  batteryNote: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    marginTop: 6,
    width: "100%",
  },
  batteryNoteTitle: { fontSize: 13, marginBottom: 3 },
  batteryNoteText: { fontSize: 12, lineHeight: 17 },
  batteryNoteBtn: { marginTop: 8 },
  batteryNoteBtnText: { fontSize: 12 },
  termsScroll: { flex: 1, width: "100%" },
  termsScrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20, gap: 14 },
  termsText: { fontSize: 13, lineHeight: 22 },
  termsCheckRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  termsCheckText: { fontSize: 13, flex: 1 },
});
