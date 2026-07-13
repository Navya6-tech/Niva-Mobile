import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNativeBackgroundService } from "@/hooks/useNativeBackgroundService";
import { useBackgroundProtection } from "@/hooks/useBackgroundProtection";

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export interface AppSettings {
  triggerPhrases: string[];
  stealthMode: boolean;
  checkInDuration: number;
  shakeSensitivity: "low" | "medium" | "high";
  audioRecording: boolean;
  voiceTriggerActive: boolean;
  onboardingComplete: boolean;
  language: "en" | "hi";
  backgroundProtectionEnabled: boolean;
}

export interface CheckInTimer {
  active: boolean;
  duration: number;
  startTime: number | null;
}

interface AppContextType {
  contacts: EmergencyContact[];
  settings: AppSettings;
  sosActive: boolean;
  safeTimestamp: number;
  sosStartTime: number | null;
  checkInTimer: CheckInTimer;
  addContact: (contact: Omit<EmergencyContact, "id">) => Promise<void>;
  updateContact: (contact: EmergencyContact) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  triggerSOS: (skipNativeTrigger?: boolean) => void;
  cancelSOS: () => void;
  startCheckIn: (minutes: number) => void;
  stopCheckIn: () => void;
  markSafe: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  triggerPhrases: ["help me", "stop", "bachao"],
  stealthMode: false,
  checkInDuration: 30,
  shakeSensitivity: "medium",
  audioRecording: false,
  voiceTriggerActive: false,
  onboardingComplete: false,
  language: "en",
  backgroundProtectionEnabled: true,
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [sosActive, setSosActive] = useState(false);
  const [safeTimestamp, setSafeTimestamp] = useState(0);
  const [sosStartTime, setSosStartTime] = useState<number | null>(null);
  const [checkInTimer, setCheckInTimer] = useState<CheckInTimer>({
    active: false,
    duration: 30,
    startTime: null,
  });
  const checkInRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [contactsData, settingsData] = await Promise.all([
        AsyncStorage.getItem("contacts"),
        AsyncStorage.getItem("settings"),
      ]);

      if (contactsData) {
        const loadedContacts = JSON.parse(contactsData);
        setContacts(loadedContacts);
        // Sync contacts to native service with retry
        if (Platform.OS === "android") {
          const phones = loadedContacts.map((c: any) => c.phone).filter(Boolean);
          if (phones.length > 0) {
            const syncContacts = (retries = 0) => {
              try {
                const { NativeModules } = require("react-native");
                if (NativeModules.NivaraService) {
                  NativeModules.NivaraService.updateEmergencyData(phones, 0, 0);
                } else if (retries < 5) {
                  setTimeout(() => syncContacts(retries + 1), 1000);
                }
              } catch (e) {
                if (retries < 5) setTimeout(() => syncContacts(retries + 1), 1000);
              }
            };
            syncContacts(); // Sync immediately, retry if not ready
          }
        }
      }

      const savedSettings = settingsData ? JSON.parse(settingsData) : {};
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...savedSettings };
      setSettings(merged);
      // Sync settings to native service after loading from AsyncStorage
      if (Platform.OS === "android") {
        const syncToNative = (retries = 0) => {
          try {
            const { NativeModules } = require("react-native");
            if (NativeModules.NivaraService) {
              NativeModules.NivaraService.setAudioRecordingEnabled(merged.audioRecording ?? false);
              NativeModules.NivaraService.setVoiceTriggerEnabled(merged.voiceTriggerActive ?? false);
            } else if (retries < 5) {
              setTimeout(() => syncToNative(retries + 1), 1000);
            }
          } catch (e) {
            if (retries < 5) setTimeout(() => syncToNative(retries + 1), 1000);
          }
        };
        syncToNative(); // Sync immediately, retry if not ready
      }

      if (!merged.onboardingComplete) {
        router.replace("/onboarding");
      }
    } catch {
    }
  };

  const addContact = useCallback(async (contact: Omit<EmergencyContact, "id">) => {
    const newContact: EmergencyContact = {
      ...contact,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };
    const updated = [...contacts, newContact];
    setContacts(updated);
    await AsyncStorage.setItem("contacts", JSON.stringify(updated));
  }, [contacts]);

  const updateContact = useCallback(async (contact: EmergencyContact) => {
    const updated = contacts.map((c) => (c.id === contact.id ? contact : c));
    setContacts(updated);
    await AsyncStorage.setItem("contacts", JSON.stringify(updated));
  }, [contacts]);

  const deleteContact = useCallback(async (id: string) => {
    const updated = contacts.filter((c) => c.id !== id);
    setContacts(updated);
    await AsyncStorage.setItem("contacts", JSON.stringify(updated));
  }, [contacts]);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await AsyncStorage.setItem("settings", JSON.stringify(updated));
  }, [settings]);

  useBackgroundProtection(settings.backgroundProtectionEnabled);

  const sosActiveRef = useRef(false);
  // Sync emergency data to native service periodically
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const { NativeModules } = require("react-native");
    const phones = contacts.map((c: EmergencyContact) => c.phone).filter(Boolean);
    const syncData = async () => {
      try {
        const Location = await import("expo-location");
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        NativeModules.NivaraService?.updateEmergencyData?.(phones, loc.coords.latitude, loc.coords.longitude);
      } catch {
        NativeModules.NivaraService?.updateEmergencyData?.(phones, 0, 0);
      }
    };
    syncData();
    // Refresh location every 2 minutes
    const interval = setInterval(syncData, 120000);
    return () => clearInterval(interval);
  }, [contacts]);

  const triggerSOS = useCallback((skipNativeTrigger?: boolean) => {
    if (sosActiveRef.current) return;
    sosActiveRef.current = true;
    setSosActive(true);
    setSosStartTime(Date.now());
    setSettings(prev => ({ ...prev, voiceTriggerActive: false }));
    router.replace("/sos-active");
    // Trigger native recording (skip if native already started it, e.g. from shake)
    if (!skipNativeTrigger) {
      try {
        const { NativeModules } = require("react-native");
        NativeModules.NivaraService?.triggerSOSFromJS?.();
      } catch (e) {}
    }
    // Send SMS via JS direct-sms (proven reliable)
    (async () => {
      try {
        const Location = await import("expo-location");
        let loc;
        try {
          loc = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000))
          ]);
        } catch (e1) {
          loc = await Location.getLastKnownPositionAsync();
        }
        if (!loc) throw new Error("no location");
        const { latitude, longitude } = loc.coords;
        const link = "https://maps.google.com/maps?q=" + latitude + "," + longitude;
        const message = "NIVARA EMERGENCY ALERT. I need help immediately. My location: " + link;
        const phones = contacts.map((c) => c.phone).filter(Boolean);
        if (phones.length > 0) {
          const { sendSMS } = require("direct-sms");
          sendSMS(phones, message);
        }
      } catch (e) {
        try {
          const phones = contacts.map((c) => c.phone).filter(Boolean);
          if (phones.length > 0) {
            const { sendSMS } = require("direct-sms");
            sendSMS(phones, "NIVARA EMERGENCY ALERT. I need help immediately. Location unavailable.");
          }
        } catch (e2) {}
      }
    })();
  }, [contacts]);
  const cancelSOS_resetRef = useCallback(() => {
    sosActiveRef.current = false;
  }, []);

  const cancelSOS = useCallback(() => {
    sosActiveRef.current = false;
    setSosActive(false);
    setSosStartTime(null);
  }, []);

  const markSafe = useCallback(() => {
    sosActiveRef.current = false;
    setSosActive(false);
    setSosStartTime(null);
    if (checkInRef.current) clearTimeout(checkInRef.current);
    setCheckInTimer({ active: false, duration: 30, startTime: null });
    router.replace("/(tabs)");
    // Delay reload so recording has time to finish saving to AsyncStorage
    setTimeout(() => setSafeTimestamp(Date.now()), 1500);
  }, []);

  const startCheckIn = useCallback((minutes: number) => {
    if (checkInRef.current) clearTimeout(checkInRef.current);
    setCheckInTimer({ active: true, duration: minutes, startTime: Date.now() });
    checkInRef.current = setTimeout(() => {
      triggerSOS();
    }, minutes * 60 * 1000);
  }, [triggerSOS]);

  const stopCheckIn = useCallback(() => {
    if (checkInRef.current) clearTimeout(checkInRef.current);
    setCheckInTimer({ active: false, duration: 30, startTime: null });
  }, []);

  return (
    <AppContext.Provider
      value={{
        contacts,
        settings,
        sosActive,
        sosStartTime,
        checkInTimer,
        addContact,
        updateContact,
        deleteContact,
        updateSettings,
        triggerSOS,
        cancelSOS,
        startCheckIn,
        stopCheckIn,
        markSafe,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
