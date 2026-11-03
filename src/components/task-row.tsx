import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { describeDue, dueStatus } from '@/lib/schedule';
import type { CareSchedule, Plant } from '@/lib/types';
import { useGarden } from '@/state/garden';
import { space, TASK_META, usePalette } from '@/theme';

import { OptionsSheet, type SheetOption } from './options-sheet';
import { Button, PlantAvatar, Row, T } from './ui';

export function TaskRow({ schedule, plant }: { schedule: CareSchedule; plant: Plant }) {
  const c = usePalette();
  const { completeTasks, postponeTask, photoUrl } = useGarden();
  const [sheet, setSheet] = useState(false);
  const meta = TASK_META[schedule.task];
  const now = new Date();
  const late = dueStatus(schedule, now).status === 'overdue';

  const options: SheetOption[] = [
    ...(schedule.task === 'water' || schedule.task === 'mist'
      ? [
          {
            label: 'Soil is still moist',
            hint: 'Check again in 2 days, and space out future reminders a bit',
            run: () => postponeTask(schedule.id, 2, true),
          },
        ]
      : []),
    { label: 'Remind me tomorrow', run: () => postponeTask(schedule.id, 1, false) },
    { label: 'Skip for a week', run: () => postponeTask(schedule.id, 7, false) },
  ];

  return (
    <View style={[styles.row, { borderColor: c.border }]}>
      <Pressable
        style={styles.main}
        accessibilityRole="link"
        onPress={() => router.push({ pathname: '/plant/[id]', params: { id: plant.id } })}>
        <PlantAvatar uri={photoUrl(plant.photo)} name={plant.nickname} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="heading" numberOfLines={1} style={{ fontSize: 16 }}>
            {plant.nickname}
          </T>
          <Row gap={6}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <T variant="small" color={late ? c.accent : undefined}>
              {meta.label} · {describeDue(schedule, now)}
            </T>
          </Row>
        </View>
      </Pressable>
      <Row gap={space.xs}>
        <Button title="Later" kind="ghost" small onPress={() => setSheet(true)} />
        <Button title="Done" small onPress={() => completeTasks([schedule.id])} />
      </Row>
      <OptionsSheet
        visible={sheet}
        title={`${meta.label} ${plant.nickname} later`}
        options={options}
        onClose={() => setSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
