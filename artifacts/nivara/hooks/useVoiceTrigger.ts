import { Platform } from "react-native";

// Voice trigger is handled by the native background service (NivaraBackgroundService.kt)
// which uses Android SpeechRecognizer directly - no beeping, works in background
export function useVoiceTrigger(active: boolean, onTriggered: () => void) {
  // No-op - handled natively
}
