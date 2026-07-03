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

  const startListening = useCallback(async () => {
    if (!activeRef.current || Platform.OS === "web" || isListening.current) return;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) return;
      isListening.current = true;
      await ExpoSpeechRecognitionModule.start({
        lang: "en-IN",
        continuous: false,
        interimResults: true,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
      });
    } catch (e) {
      isListening.current = false;
      if (activeRef.current) {
        restartTimer.current = setTimeout(() => startListening(), 1000);
      }
    }
  }, []);

  const stopListening = useCallback(async () => {
    isListening.current = false;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try { await ExpoSpeechRecognitionModule.stop(); } catch (e) {}
    triggeredRef.current = false;
  }, []);

  const checkTranscript = useCallback((transcript: string) => {
    if (!activeRef.current || triggeredRef.current || !transcript) return;
    const t = transcript.toLowerCase().trim();
    const phrases = phrasesRef.current;
    
    // Check exact match or partial match
    const matched = phrases.some(phrase => {
      const p = phrase.toLowerCase().trim();
      return t.includes(p) || p.includes(t) || similarity(t, p) > 0.7;
    });

    if (matched) {
      triggeredRef.current = true;
      onTriggeredRef.current();
      setTimeout(() => { triggeredRef.current = false; }, 10000);
    }
  }, []);

  // Fuzzy match — handles slight mispronunciations
  function similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    return matches / longer.length;
  }

  useSpeechRecognitionEvent("result", (event) => {
    const results = event.results ?? [];
    for (const r of results) {
      checkTranscript(r.transcript ?? "");
    }
  });

  useSpeechRecognitionEvent("end", () => {
    isListening.current = false;
    // Immediately restart - no gap in listening
    if (activeRef.current) {
      restartTimer.current = setTimeout(() => startListening(), 100);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    isListening.current = false;
    // Restart quickly on error
    if (activeRef.current) {
      const delay = event.error === "no-speech" ? 100 : 1000;
      restartTimer.current = setTimeout(() => startListening(), delay);
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
