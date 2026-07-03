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
  triggerSOS: () => void;
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

      if (contactsData) setContacts(JSON.parse(contactsData));

      const savedSettings = settingsData ? JSON.parse(settingsData) : {};
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...savedSettings };
      setSettings(merged);

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

  const triggerSOS = useCallback(() => {
    setSosActive(true);
    setSosStartTime(Date.now());
    setSettings(prev => ({ ...prev, voiceTriggerActive: false }));
    router.push("/sos-active");
  }, []);

  const cancelSOS = useCallback(() => {
    setSosActive(false);
    setSosStartTime(null);
  }, []);

  const markSafe = useCallback(() => {
    setSosActive(false);
    setSosStartTime(null);
    if (checkInRef.current) clearTimeout(checkInRef.current);
    setCheckInTimer({ active: false, duration: 30, startTime: null });
    setSafeTimestamp(Date.now());
    router.back();
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
