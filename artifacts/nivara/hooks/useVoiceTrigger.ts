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
  const isListening = useRef(false);
  const phrasesRef = useRef(settings.triggerPhrases);

  activeRef.current = active;
  onTriggeredRef.current = onTriggered;
  phrasesRef.current = settings.triggerPhrases;

  const stopListening = useCallback(() => {
    isListening.current = false;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try { ExpoSpeechRecognitionModule.abort(); } catch(e) {}
  }, []);

  const startListening = useCallback(async () => {
    if (!activeRef.current || Platform.OS === "web") return;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) return;
      isListening.current = true;
      ExpoSpeechRecognitionModule.start({
        lang: "hi-IN",
        interimResults: true,
        continuous: true,
        contextualStrings: phrasesRef.current,
      });
    } catch (e) {
      isListening.current = false;
      if (activeRef.current) {
        restartTimer.current = setTimeout(() => startListening(), 2000);
      }
    }
  }, []);

  useSpeechRecognitionEvent("result", (event) => {
    if (!activeRef.current || triggeredRef.current) return;
    for (const r of (event.results ?? [])) {
      const t = (r.transcript ?? "").toLowerCase().trim();
      if (!t) continue;
      const matched = phrasesRef.current.some(p => t.includes(p.toLowerCase().trim()));
      if (matched) {
        triggeredRef.current = true;
        onTriggeredRef.current();
        setTimeout(() => { triggeredRef.current = false; }, 10000);
        return;
      }
    }
  });

  useSpeechRecognitionEvent("end", () => {
    isListening.current = false;
    if (activeRef.current) {
      restartTimer.current = setTimeout(() => startListening(), 1000);
    }
  });

  useSpeechRecognitionEvent("error", (e) => {
    isListening.current = false;
    if (activeRef.current) {
      restartTimer.current = setTimeout(() => startListening(), 2000);
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
