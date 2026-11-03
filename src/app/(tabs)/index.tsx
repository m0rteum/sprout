import { router } from 'expo-router';
import { View } from 'react-native';

import { TaskRow } from '@/components/task-row';
import { Button, Card, Empty, Row, Screen, T } from '@/components/ui';
import { describeDue, dueNow } from '@/lib/schedule';
import type { CareSchedule, Plant } from '@/lib/types';
import { useGarden } from '@/state/garden';
import { space, TASK_META, usePalette } from '@/theme';

const NO_SITE = '__none__';

export default function TodayScreen() {
  const c = usePalette();
  const { data, prefs, completeTasks, setPrefs } = useGarden();
  const now = new Date();

  const plantById = new Map(data.plants.map((p) => [p.id, p]));
  const live = data.schedules.filter((s) => plantById.has(s.plantId));
  const due = dueNow(live, now);

  const groups = (() => {
    const bySite = new Map<string, { schedule: CareSchedule; plant: Plant }[]>();
    for (const s of due) {
      const plant = plantById.get(s.plantId)!;
      const key = plant.siteId ?? NO_SITE;
      bySite.set(key, [...(bySite.get(key) ?? []), { schedule: s, plant }]);
    }
    return [...bySite.entries()].map(([siteId, items]) => ({
      siteId,
      name: data.sites.find((x) => x.id === siteId)?.name ?? 'Other plants',
      items,
    }));
  })();

  const upcoming = live
    .filter((s) => s.enabled && !due.includes(s))
    .sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt))
    .slice(0, 6);

  const onVacation = prefs.vacationUntil && new Date(prefs.vacationUntil) > now;
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Screen safeTop>
      <View style={{ gap: 2 }}>
        <T variant="label">{dateLabel}</T>
        <T variant="title">Today</T>
      </View>

      {onVacation ? (
        <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accentSoft }}>
          <T style={{ fontWeight: '700' }}>
            Away mode until {new Date(prefs.vacationUntil!).toLocaleDateString()}
          </T>
          <T variant="muted">Reminders are paused. Tasks will be waiting when you get back.</T>
          <Button title="I'm back" kind="secondary" small onPress={() => setPrefs({ vacationUntil: null })} />
        </Card>
      ) : null}

      {data.plants.length === 0 ? (
        <Empty
          title="No plants yet"
          body="Add your first plant and Sprout will work out when it needs water, food and a little attention."
          action={<Button title="Add a plant" onPress={() => router.push('/add-plant')} />}
        />
      ) : due.length === 0 ? (
        <Card>
          <T variant="heading">All caught up</T>
          <T variant="muted">
            Nothing needs doing today.
            {upcoming[0]
              ? ` Next up: ${TASK_META[upcoming[0].task].label.toLowerCase()} ${
                  plantById.get(upcoming[0].plantId)?.nickname
                }, ${describeDue(upcoming[0], now).toLowerCase()}.`
              : ''}
          </T>
        </Card>
      ) : (
        groups.map((g) => {
          const waterIds = g.items.filter((i) => i.schedule.task === 'water').map((i) => i.schedule.id);
          return (
            <Card key={g.siteId} style={{ paddingVertical: space.sm }}>
              <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
                <T variant="label">{g.name}</T>
                {waterIds.length > 1 ? (
                  <Button title="Water all" kind="ghost" small onPress={() => completeTasks(waterIds)} />
                ) : null}
              </Row>
              <View>
                {g.items.map(({ schedule, plant }) => (
                  <TaskRow key={schedule.id} schedule={schedule} plant={plant} />
                ))}
              </View>
            </Card>
          );
        })
      )}

      {upcoming.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <T variant="label">Coming up</T>
          <Card style={{ gap: space.sm }}>
            {upcoming.map((s) => (
              <Row key={s.id} style={{ justifyContent: 'space-between' }}>
                <Row gap={space.sm} style={{ flex: 1 }}>
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TASK_META[s.task].color }}
                  />
                  <T numberOfLines={1} style={{ flex: 1 }}>
                    {TASK_META[s.task].label} {plantById.get(s.plantId)?.nickname}
                  </T>
                </Row>
                <T variant="small">{describeDue(s, now)}</T>
              </Row>
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
