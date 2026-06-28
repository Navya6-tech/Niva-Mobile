import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

export const BACKGROUND_PROTECTION_TASK = "NIVARA_BACKGROUND_PROTECTION";
export const LOCATION_TASK_NAME = "NIVARA_LOCATION_TASK";
export const HEADLESS_SOS_TASK = "NIVARA_HEADLESS_SOS";

TaskManager.defineTask(BACKGROUND_PROTECTION_TASK, async () => {
  return BackgroundFetch.BackgroundFetchResult.NewData;
});

TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({
    error,
  }: TaskManager.TaskManagerTaskBody<{
    locations: { coords: { latitude: number; longitude: number } }[];
  }>) => {
    if (error) return;
    // Location updates keep the foreground service alive
    // which keeps the JS thread running for shake/voice detection
  }
);
