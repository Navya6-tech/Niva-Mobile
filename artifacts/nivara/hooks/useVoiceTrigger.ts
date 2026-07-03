import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useApp } from "@/context/AppContext";

export function useVoiceTrigger(active: boolean, onTriggered: () => void) {
  const { settings } = useApp();
  const activeRef = useRef(active);
  const onTriggeredRef = useRef(onTriggered);
  const triggeredRef = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phrasesRef = useRef(settings.triggerPhrases);

  activeRef.current = active;
  onTriggeredRef.current = onTriggered;
  phrasesRef.current = settings.triggerPhrases;

  const startListening = useCallback(async () => {
    if (!activeRef.current || Platform.OS === "web") return;
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) return;
      await ExpoSpeechRecognitionModule.start({
        lang: "en-IN",
        continuous: true,
        interimResults: true,
        requiresOnDeviceRecognition: false,
      });
    } catch (e) {
      if (activeRef.current) {
        restartTimer.current = setTimeout(() => startListening(), 2000);
      }
    }
  }, []);

  const stopListening = useCallback(async () => {
    try { await ExpoSpeechRecognitionModule.stop(); } catch (e) {}
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    triggeredRef.current = false;
  }, []);

  useSpeechRecognitionEvent("result", (event) => {
    if (!activeRef.current || triggeredRef.current) return;
    const transcript = (event.results?.[0]?.transcript ?? "").toLowerCase().trim();
    if (!transcript) return;

    const phrases = phrasesRef.current;
    const matched = phrases.some(phrase => transcript.includes(phrase.toLowerCase()));
    if (matched) {
      triggeredRef.current = true;
      onTriggeredRef.current();
      setTimeout(() => { triggeredRef.current = false; }, 10000);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (activeRef.current) {
      restartTimer.current = setTimeout(() => startListening(), 300);
    }
  });

  useSpeechRecognitionEvent("error", () => {
    if (activeRef.current) {
      restartTimer.current = setTimeout(() => startListening(), 1500);
    }
  });

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (active) {
      triggeredRef.current = false;
      startListening();
    } else {
      stopListening();
    }
    return () => { stopListening(); };
  }, [active, startListening, stopListening]);
}
