import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RecordingMeta {
  id: string;
  uri: string;
  date: number;
  durationMs: number;
  size: number;
  keepForever: boolean;
}

export const RECORDINGS_KEY = "sos_recordings";
export const AUTO_DELETE_MS = 72 * 60 * 60 * 1000;

export function formatRecordingDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRecordingDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function formatRecordingSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function loadRecordings(): Promise<RecordingMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
    if (!raw) return [];
    const all: RecordingMeta[] = JSON.parse(raw);
    const now = Date.now();
    return all.filter((r) => r.keepForever || now - r.date < AUTO_DELETE_MS);
  } catch {
    return [];
  }
}

export async function saveRecordingMeta(meta: RecordingMeta) {
  try {
    const existing = await loadRecordings();
    const updated = [...existing.filter((r) => r.id !== meta.id), meta];
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));
  } catch {}
}

export async function deleteRecordingById(id: string) {
  try {
    const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
    if (!raw) return;
    const all: RecordingMeta[] = JSON.parse(raw);
    await AsyncStorage.setItem(
      RECORDINGS_KEY,
      JSON.stringify(all.filter((r) => r.id !== id))
    );
  } catch {}
}
