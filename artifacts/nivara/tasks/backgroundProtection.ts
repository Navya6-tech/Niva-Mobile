import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

export const BACKGROUND_PROTECTION_TASK = "NIVARA_BACKGROUND_PROTECTION";

TaskManager.defineTask(BACKGROUND_PROTECTION_TASK, async () => {
  return BackgroundFetch.BackgroundFetchResult.NewData;
});
