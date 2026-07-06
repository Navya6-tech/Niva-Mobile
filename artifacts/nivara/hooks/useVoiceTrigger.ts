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
      console.log("NIVARA permission granted:", granted);
      if (!granted) return;
      isListening.current = true;
      console.log("NIVARA starting with phrases:", phrasesRef.current);
      ExpoSpeechRecognitionModule.start({
        lang: "en-IN",
        interimResults: true,
        continuous: true,
        contextualStrings: phrasesRef.current,
      });
      console.log("NIVARA start called");
    } catch (e) {
      console.log("NIVARA start error:", e);
      isListening.current = false;
      if (activeRef.current) {
        restartTimer.current = setTimeout(() => startListening(), 2000);
      }
    }
  }, []);

  useSpeechRecognitionEvent("start", () => {
    console.log("NIVARA recognition started");
  });

  useSpeechRecognitionEvent("result", (event) => {
    console.log("NIVARA result event:", JSON.stringify(event.results));
    if (!activeRef.current || triggeredRef.current) return;
    for (const r of (event.results ?? [])) {
      const t = (r.transcript ?? "").toLowerCase().trim();
      if (!t) continue;
      console.log("NIVARA heard:", t, "| phrases:", phrasesRef.current);
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
    console.log("NIVARA recognition ended");
    isListening.current = false;
    if (activeRef.current) {
      restartTimer.current = setTimeout(() => startListening(), 1000);
    }
  });

  useSpeechRecognitionEvent("error", (e) => {
    console.log("NIVARA recognition error:", e.error, e.message);
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
