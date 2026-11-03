import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { PhotoButton } from '@/components/photo-button';
import { Button, Card, Chip, Field, Row, Screen, T } from '@/components/ui';
import { searchSpecies, type Species } from '@/data/species';
import { requestReminderPermission } from '@/lib/notifications';
import { identifyPlant, isIdentifyConfigured, type IdentifyResult } from '@/lib/plantnet';
import { LIGHT_LEVELS, type LightLevel } from '@/lib/types';
import { useGarden } from '@/state/garden';
import { LIGHT_LABEL, radius, space, usePalette } from '@/theme';

const POTS = [
  { label: 'Small (<12 cm)', cm: 10 },
  { label: 'Medium', cm: 18 },
  { label: 'Large (>30 cm)', cm: 35 },
];

const LAST_WATERED = [
  { label: 'Today', days: 0 },
  { label: 'A few days ago', days: 3 },
  { label: 'A week or more', days: 7 },
  { label: 'No idea', days: 30 },
];

export default function AddPlantScreen() {
  const c = usePalette();
  const garden = useGarden();
  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState<Species | null>(null);
  const [customName, setCustomName] = useState('');
  const [nickname, setNickname] = useState('');
  const [siteId, setSiteId] = useState<string | null>(garden.data.sites[0]?.id ?? null);
  const [newSite, setNewSite] = useState('');
  const [newSiteLight, setNewSiteLight] = useState<LightLevel>('medium');
  const [pot, setPot] = useState(18);
  const [drainage, setDrainage] = useState(true);
  const [lastWatered, setLastWatered] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [idResults, setIdResults] = useState<IdentifyResult[] | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const results = searchSpecies(query).slice(0, 12);

  const choose = (s: Species | null, name?: string) => {
    setSpecies(s);
    if (!s) setCustomName(name ?? query.trim());
    setStep('details');
  };

  const identify = async (uri: string) => {
    setPhoto(uri);
    setIdentifying(true);
    setIdError(null);
    setIdResults(null);
    try {
      setIdResults(await identifyPlant(uri));
    } catch (e) {
      setIdError(e instanceof Error ? e.message : 'Identification failed');
    } finally {
      setIdentifying(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      let site = siteId;
      if (newSite.trim()) site = (await garden.addSite(newSite, newSiteLight, true)).id;
      const speciesName = species?.commonName ?? customName.trim();
      const plant = await garden.addPlant({
        nickname: nickname.trim() || speciesName,
        speciesId: species?.id ?? null,
        speciesName,
        siteId: site,
        potDiameterCm: pot,
        hasDrainage: drainage,
        notes: '',
        photoUri: photo,
        lastWateredDaysAgo: lastWatered,
      });
      void requestReminderPermission();
      router.replace({ pathname: '/plant/[id]', params: { id: plant.id } });
    } finally {
      setSaving(false);
    }
  };

  if (step === 'pick') {
    return (
      <Screen>
        <T variant="muted">What kind of plant is it?</T>

        {isIdentifyConfigured ? (
          <Card>
            <T variant="heading">Identify from a photo</T>
            <PhotoButton label={photo ? 'Try another photo' : 'Snap or choose a photo'} onPicked={identify} />
            {identifying ? <ActivityIndicator color={c.primary} /> : null}
            {idError ? <T variant="small" color={c.danger}>{idError}</T> : null}
            {idResults?.length === 0 ? <T variant="small">No match. Try a clearer photo of the leaves.</T> : null}
            {idResults?.map((r) => (
              <Pressable
                key={r.scientificName}
                accessibilityRole="button"
                onPress={() => choose(r.match ?? null, r.commonName ?? r.scientificName)}
                style={{ paddingVertical: space.sm, borderTopWidth: 0.5, borderColor: c.border }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '700' }}>{r.match?.commonName ?? r.commonName ?? r.scientificName}</T>
                    <T variant="small">
                      {r.scientificName}
                      {r.match ? '' : ' · no care profile yet, defaults used'}
                    </T>
                  </View>
                  <T variant="small">{Math.round(r.score * 100)}%</T>
                </Row>
              </Pressable>
            ))}
          </Card>
        ) : null}

        <Field
          label="Search"
          placeholder="Monstera, pothos, snake plant…"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoFocus={!isIdentifyConfigured}
        />
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          {results.map((s, i) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              onPress={() => choose(s)}
              style={({ pressed }) => ({
                paddingVertical: space.md,
                borderTopWidth: i === 0 ? 0 : 0.5,
                borderColor: c.border,
                opacity: pressed ? 0.6 : 1,
              })}>
              <T style={{ fontWeight: '700' }}>{s.commonName}</T>
              <T variant="small">{s.scientificName}</T>
            </Pressable>
          ))}
          {results.length === 0 ? (
            <T variant="small" style={{ paddingVertical: space.md }}>
              Not in the catalog yet.
            </T>
          ) : null}
        </Card>
        <Button
          title={query.trim() ? `Add “${query.trim()}” with default care` : 'Something else'}
          kind="secondary"
          onPress={() => choose(null)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="heading">{species?.commonName ?? (customName || 'Custom plant')}</T>
          {species ? <T variant="small">{species.scientificName}</T> : null}
        </View>
        <Button title="Change" kind="ghost" small onPress={() => setStep('pick')} />
      </Row>

      {!species ? (
        <Field label="Species or type" value={customName} onChangeText={setCustomName} placeholder="e.g. String of hearts" />
      ) : null}
      <Field
        label="Nickname"
        value={nickname}
        onChangeText={setNickname}
        placeholder={species?.commonName ?? 'Give it a name'}
      />

      <View style={{ gap: space.sm }}>
        <T variant="label">Where does it live?</T>
        <Row style={{ flexWrap: 'wrap' }}>
          {garden.data.sites.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              selected={!newSite && siteId === s.id}
              onPress={() => {
                setSiteId(s.id);
                setNewSite('');
              }}
            />
          ))}
        </Row>
        <Field
          label={garden.data.sites.length ? 'Or a new place' : 'Name the place'}
          placeholder="Living room window"
          value={newSite}
          onChangeText={setNewSite}
        />
        {newSite.trim() ? (
          <Row style={{ flexWrap: 'wrap' }}>
            {LIGHT_LEVELS.map((l) => (
              <Chip key={l} label={LIGHT_LABEL[l].label} selected={newSiteLight === l} onPress={() => setNewSiteLight(l)} />
            ))}
          </Row>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">Pot</T>
        <Row style={{ flexWrap: 'wrap' }}>
          {POTS.map((p) => (
            <Chip key={p.cm} label={p.label} selected={pot === p.cm} onPress={() => setPot(p.cm)} />
          ))}
        </Row>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="Has drainage holes" selected={drainage} onPress={() => setDrainage(true)} />
          <Chip label="No drainage" selected={!drainage} onPress={() => setDrainage(false)} />
        </Row>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">Last watered</T>
        <Row style={{ flexWrap: 'wrap' }}>
          {LAST_WATERED.map((o) => (
            <Chip key={o.label} label={o.label} selected={lastWatered === o.days} onPress={() => setLastWatered(o.days)} />
          ))}
        </Row>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">Photo</T>
        <Row>
          {photo ? <Image source={{ uri: photo }} style={{ width: 72, height: 72, borderRadius: radius.sm }} /> : null}
          <PhotoButton label={photo ? 'Change photo' : 'Add photo'} small onPicked={setPhoto} />
        </Row>
      </View>

      <Button
        title="Add plant"
        loading={saving}
        disabled={!species && !customName.trim()}
        onPress={save}
      />
    </Screen>
  );
}
