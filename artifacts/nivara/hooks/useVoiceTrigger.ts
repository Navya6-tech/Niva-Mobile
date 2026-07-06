import { useEffect, useRef, useCallback } from "react";
import { AppState, Platform } from "react-native";
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
  const errorCount = useRef(0);

  activeRef.current = active;
  onTriggeredRef.current = onTriggered;
  phrasesRef.current = settings.triggerPhrases;

  const startListening = useCallback(async () => {
    if (!activeRef.current || Platform.OS === "web" || isListening.current) return;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) return;
      isListening.current = true;
      errorCount.current = 0;
      await ExpoSpeechRecognitionModule.start({
        lang: "en-IN",
        continuous: true,
        interimResults: true,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
        contextualStrings: phrasesRef.current,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: "web_search",
          "android.speech.extra.EXTRA_ADDITIONAL_LANGUAGES": ["hi-IN"],
        },
      });
    } catch (e) {
      isListening.current = false;
      if (activeRef.current) {
        const delay = Math.min(3000, 1000 * (errorCount.current + 1));
        errorCount.current++;
        restartTimer.current = setTimeout(() => startListening(), delay);
      }
    }
  }, []);

  const stopListening = useCallback(async () => {
    isListening.current = false;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try { await ExpoSpeechRecognitionModule.stop(); } catch (e) {}
    triggeredRef.current = false;
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
        break;
      }
    }
  });

  useSpeechRecognitionEvent("end", () => {
    isListening.current = false;
    if (activeRef.current) {
      // Longer delay to avoid One UI blocking mic
      restartTimer.current = setTimeout(() => startListening(), 1000);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    isListening.current = false;
    if (activeRef.current) {
      const delay = event.error === "no-speech" ? 500 : Math.min(5000, 1000 * (errorCount.current + 1));
      errorCount.current++;
      restartTimer.current = setTimeout(() => startListening(), delay);
    }
  });

  // Restart when app comes to foreground
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && activeRef.current && !isListening.current) {
        errorCount.current = 0;
        startListening();
      }
    });
    return () => sub.remove();
  }, [startListening]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (active) {
      triggeredRef.current = false;
      errorCount.current = 0;
      startListening();
    } else {
      stopListening();
    }
    return () => { stopListening(); };
  }, [active, startListening, stopListening]);
}
