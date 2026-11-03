import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { PhotoButton } from '@/components/photo-button';
import { Button, Card, Chip, Field, PlantAvatar, Row, Screen, T } from '@/components/ui';
import { getSpecies } from '@/data/species';
import { confirm } from '@/lib/confirm';
import { describeDue, MAX_INTERVAL_DAYS } from '@/lib/schedule';
import { CARE_TASKS, type CareSchedule } from '@/lib/types';
import { useGarden } from '@/state/garden';
import { LIGHT_LABEL, radius, space, TASK_META, usePalette } from '@/theme';

export default function PlantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = usePalette();
  const garden = useGarden();
  const { data, photoUrl } = garden;
  const plant = data.plants.find((p) => p.id === id);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(plant?.nickname ?? '');
  const [notes, setNotes] = useState(plant?.notes ?? '');
  const [entryNote, setEntryNote] = useState('');
  const [entryPhoto, setEntryPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!plant) {
    return (
      <Screen>
        <T variant="muted">This plant is gone.</T>
      </Screen>
    );
  }

  const now = new Date();
  const species = getSpecies(plant.speciesId);
  const site = data.sites.find((s) => s.id === plant.siteId);
  const schedules = CARE_TASKS.map((t) =>
    data.schedules.find((s) => s.plantId === plant.id && s.task === t),
  ).filter((s): s is CareSchedule => Boolean(s));
  const history = data.logs
    .filter((l) => l.plantId === plant.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15);
  const journal = data.journal
    .filter((j) => j.plantId === plant.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const hero = photoUrl(plant.photo);

  const lightOrder = ['low', 'medium', 'bright', 'direct'];
  const lightMismatch =
    species &&
    site &&
    !species.toleratesLowLight &&
    lightOrder.indexOf(site.light) < lightOrder.indexOf(species.idealLight);

  const adjustInterval = (s: CareSchedule, delta: number) => {
    const intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.max(1, s.intervalDays + delta));
    const shift = intervalDays - s.intervalDays;
    const next = new Date(s.nextDueAt);
    next.setDate(next.getDate() + shift);
    void garden.updateSchedule({ ...s, intervalDays, nextDueAt: next.toISOString() });
  };

  const saveEdits = async () => {
    await garden.updatePlant({ ...plant, nickname: nickname.trim() || plant.nickname, notes });
    setEditing(false);
  };

  const addEntry = async () => {
    setSaving(true);
    try {
      await garden.addJournalEntry(plant.id, entryNote, entryPhoto);
      setEntryNote('');
      setEntryPhoto(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: plant.nickname }} />

      <View style={{ alignItems: 'center', gap: space.md }}>
        {hero ? (
          <Image
            source={{ uri: hero }}
            style={{ width: '100%', aspectRatio: 1, maxHeight: 360, borderRadius: radius.lg }}
            contentFit="cover"
          />
        ) : (
          <PlantAvatar uri={null} name={plant.nickname} size={120} />
        )}
        <PhotoButton
          label={hero ? 'Change photo' : 'Add photo'}
          kind="ghost"
          small
          onPicked={(uri) => void garden.updatePlant(plant, uri)}
        />
      </View>

      {editing ? (
        <Card>
          <Field label="Name" value={nickname} onChangeText={setNickname} />
          <T variant="label">Place</T>
          <Row style={{ flexWrap: 'wrap' }}>
            {data.sites.map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                selected={plant.siteId === s.id}
                onPress={() => void garden.updatePlant({ ...plant, siteId: s.id })}
              />
            ))}
          </Row>
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
          <Row>
            <Button title="Save" onPress={saveEdits} />
            <Button title="Cancel" kind="ghost" onPress={() => setEditing(false)} />
          </Row>
        </Card>
      ) : (
        <View style={{ gap: space.xs }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="title" style={{ flex: 1 }}>
              {plant.nickname}
            </T>
            <Button title="Edit" kind="ghost" small onPress={() => setEditing(true)} />
          </Row>
          {plant.speciesName ? (
            <T variant="muted">
              {plant.speciesName}
              {species ? ` · ${species.scientificName}` : ''}
            </T>
          ) : null}
          <T variant="small">{site ? `${site.name} · ${LIGHT_LABEL[site.light].label}` : 'No place set'}</T>
          {plant.notes ? <T style={{ marginTop: space.sm }}>{plant.notes}</T> : null}
        </View>
      )}

      {species?.toxicToPets ? (
        <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accentSoft }}>
          <T style={{ fontWeight: '700' }}>Toxic to cats and dogs</T>
          <T variant="small">Keep it out of reach of pets (per ASPCA plant lists).</T>
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        <T variant="label">Care schedule</T>
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          {schedules.map((s, i) => {
            const meta = TASK_META[s.task];
            return (
              <View
                key={s.id}
                style={{
                  paddingVertical: space.md,
                  gap: space.sm,
                  borderTopWidth: i === 0 ? 0 : 0.5,
                  borderColor: c.border,
                  opacity: s.enabled ? 1 : 0.5,
                }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={space.sm}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: meta.color }} />
                    <T style={{ fontWeight: '700' }}>{meta.label}</T>
                  </Row>
                  <Switch
                    value={s.enabled}
                    onValueChange={(enabled) => void garden.updateSchedule({ ...s, enabled })}
                    trackColor={{ true: c.primary }}
                    accessibilityLabel={`${meta.label} reminders`}
                  />
                </Row>
                {s.enabled ? (
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row gap={space.xs}>
                      <Button title="−" kind="secondary" small onPress={() => adjustInterval(s, -1)} />
                      <T style={{ minWidth: 92, textAlign: 'center' }}>Every {s.intervalDays} d</T>
                      <Button title="+" kind="secondary" small onPress={() => adjustInterval(s, 1)} />
                    </Row>
                    <Row gap={space.sm}>
                      <T variant="small">{describeDue(s, now)}</T>
                      <Button title="Done" small onPress={() => void garden.completeTasks([s.id])} />
                    </Row>
                  </Row>
                ) : null}
              </View>
            );
          })}
        </Card>
        <T variant="small">
          Watering stretches automatically in winter. Fertilizing pauses until spring.
        </T>
      </View>

      {species ? (
        <View style={{ gap: space.sm }}>
          <T variant="label">Care guide</T>
          <Card>
            <T>{species.tips}</T>
            <T variant="small">
              Prefers {LIGHT_LABEL[species.idealLight].label.toLowerCase()}
              {species.toleratesLowLight ? ', tolerates low light' : ''} · {species.difficulty}
            </T>
            {lightMismatch ? (
              <T variant="small" color={c.accent}>
                {site?.name} may be too dim for this plant. Consider a brighter spot.
              </T>
            ) : null}
          </Card>
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <T variant="label">Journal</T>
        <Card>
          <Field
            label="New entry"
            placeholder="New leaf! Spotted some yellowing…"
            value={entryNote}
            onChangeText={setEntryNote}
            multiline
          />
          {entryPhoto ? (
            <Image source={{ uri: entryPhoto }} style={{ width: 96, height: 96, borderRadius: radius.sm }} />
          ) : null}
          <Row>
            <PhotoButton label={entryPhoto ? 'Change photo' : 'Add photo'} small onPicked={setEntryPhoto} />
            <Button
              title="Save entry"
              small
              loading={saving}
              disabled={!entryNote.trim() && !entryPhoto}
              onPress={addEntry}
            />
          </Row>
        </Card>
        {journal.map((j) => {
          const url = photoUrl(j.photo);
          return (
            <Card key={j.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="small">{new Date(j.at).toLocaleDateString()}</T>
                <Button
                  title="Delete"
                  kind="ghost"
                  small
                  onPress={() =>
                    confirm('Delete entry?', 'This cannot be undone.', 'Delete', () =>
                      void garden.removeJournalEntry(j.id),
                    )
                  }
                />
              </Row>
              {url ? (
                <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.sm }} />
              ) : null}
              {j.note ? <T>{j.note}</T> : null}
            </Card>
          );
        })}
      </View>

      {history.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <T variant="label">History</T>
          <Card style={{ gap: space.sm }}>
            {history.map((l) => (
              <Row key={l.id} style={{ justifyContent: 'space-between' }}>
                <T>
                  {l.action === 'done' ? TASK_META[l.task].verb : `${TASK_META[l.task].label} postponed`}
                  {l.by ? ` by ${l.by}` : ''}
                </T>
                <T variant="small">{new Date(l.at).toLocaleDateString()}</T>
              </Row>
            ))}
          </Card>
        </View>
      ) : null}

      <Button
        title="Delete plant"
        kind="danger"
        onPress={() =>
          confirm(`Delete ${plant.nickname}?`, 'Its schedule, journal and history go too.', 'Delete', () => {
            void garden.removePlant(plant.id);
            router.back();
          })
        }
      />
    </Screen>
  );
}
