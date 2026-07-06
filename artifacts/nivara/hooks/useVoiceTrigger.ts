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
        contextualStrings: phrasesRef.current,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: "web_search",
          EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE: false,
          "android.speech.extra.EXTRA_ADDITIONAL_LANGUAGES": ["hi-IN", "en-US"],
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 300,
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
        },
      });
    } catch (e) {
      isListening.current = false;
      if (activeRef.current) restartTimer.current = setTimeout(() => startListening(), 1000);
    }
  }, []);

  const stopListening = useCallback(async () => {
    isListening.current = false;
    if (restartTimer.current) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    try { await ExpoSpeechRecognitionModule.stop(); } catch (e) {}
    triggeredRef.current = false;
  }, []);

  const checkTranscript = (transcript: string) => {
    if (!activeRef.current || triggeredRef.current || !transcript) return;
    const t = transcript.toLowerCase().trim();
    const phrases = phrasesRef.current;
    
    const matched = phrases.some(phrase => {
      const p = phrase.toLowerCase().trim();
      // Exact match
      if (t.includes(p)) return true;
      // Fuzzy - allow 1 character difference for short words
      if (p.length <= 4) return t.includes(p);
      // Check if most characters match (80% similarity)
      const words = t.split(" ");
      return words.some(word => {
        if (Math.abs(word.length - p.length) > 2) return false;
        let matches = 0;
        for (const ch of p) { if (word.includes(ch)) matches++; }
        return matches / p.length >= 0.8;
      });
    });

    if (matched) {
      triggeredRef.current = true;
      onTriggeredRef.current();
      setTimeout(() => { triggeredRef.current = false; }, 10000);
    }
  };

  useSpeechRecognitionEvent("result", (event) => {
    for (const r of (event.results ?? [])) {
      checkTranscript(r.transcript ?? "");
    }
  });

  useSpeechRecognitionEvent("end", () => {
    isListening.current = false;
    if (activeRef.current) {
      restartTimer.current = setTimeout(() => startListening(), 150);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    isListening.current = false;
    if (activeRef.current) {
      restartTimer.current = setTimeout(() => startListening(), event.error === "no-speech" ? 150 : 800);
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
