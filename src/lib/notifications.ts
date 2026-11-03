import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, dueCountsByDay, startOfDay } from './schedule';
import type { CareSchedule, Plant, Preferences } from './types';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

const DAYS_AHEAD = 7;

/**
 * Replace all scheduled reminders with one daily summary for each of the next
 * week's days that has care due. Called whenever the garden changes.
 */
export async function syncReminders(
  schedules: CareSchedule[],
  plants: Plant[],
  prefs: Preferences,
): Promise<void> {
  if (!supported) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const vacationEnd = prefs.vacationUntil ? new Date(prefs.vacationUntil) : null;
  const counts = dueCountsByDay(schedules, now, DAYS_AHEAD);
  const nameById = new Map(plants.map((p) => [p.id, p.nickname]));

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const at = addDays(startOfDay(now), i);
    at.setHours(prefs.reminderHour, prefs.reminderMinute, 0, 0);
    if (at <= now || counts[i] === 0) continue;
    if (vacationEnd && at < vacationEnd) continue;

    const dayEnd = addDays(startOfDay(now), i + 1);
    const names = [
      ...new Set(
        schedules
          .filter((s) => s.enabled && new Date(s.nextDueAt) < dayEnd)
          .map((s) => nameById.get(s.plantId))
          .filter((n): n is string => Boolean(n)),
      ),
    ];
    const listed = names.slice(0, 3).join(', ');
    const more = names.length > 3 ? ` and ${names.length - 3} more` : '';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: counts[i] === 1 ? '1 plant task today' : `${counts[i]} plant tasks today`,
        body: `${listed}${more} could use some care.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
}
