import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Field, Row, Screen, T } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { LIGHT_LEVELS, type LightLevel } from '@/lib/types';
import { useGarden } from '@/state/garden';
import { LIGHT_LABEL, space } from '@/theme';

export default function SitesScreen() {
  const garden = useGarden();
  const [name, setName] = useState('');
  const [light, setLight] = useState<LightLevel>('medium');
  const [indoor, setIndoor] = useState(true);

  const add = async () => {
    await garden.addSite(name, light, indoor);
    setName('');
  };

  return (
    <Screen>
      <T variant="muted">
        Places tell Sprout how much light your plants get. Brighter spots dry out faster, so they get
        watered more often.
      </T>

      {garden.data.sites.map((site) => {
        const count = garden.data.plants.filter((p) => p.siteId === site.id).length;
        return (
          <Card key={site.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T variant="heading">{site.name}</T>
                <T variant="small">
                  {count} {count === 1 ? 'plant' : 'plants'} · {site.indoor ? 'Indoors' : 'Outdoors'}
                </T>
              </View>
              <Button
                title="Remove"
                kind="ghost"
                small
                onPress={() =>
                  confirm(`Remove ${site.name}?`, 'Plants here will be kept without a place.', 'Remove', () =>
                    void garden.removeSite(site.id),
                  )
                }
              />
            </Row>
            <Row style={{ flexWrap: 'wrap' }}>
              {LIGHT_LEVELS.map((l) => (
                <Chip
                  key={l}
                  label={LIGHT_LABEL[l].label}
                  selected={site.light === l}
                  onPress={() => void garden.updateSite({ ...site, light: l })}
                />
              ))}
            </Row>
          </Card>
        );
      })}

      <Card>
        <T variant="heading">New place</T>
        <Field label="Name" placeholder="Bedroom, kitchen sill, balcony…" value={name} onChangeText={setName} />
        <View style={{ gap: space.sm }}>
          <T variant="label">Light</T>
          <Row style={{ flexWrap: 'wrap' }}>
            {LIGHT_LEVELS.map((l) => (
              <Chip key={l} label={LIGHT_LABEL[l].label} selected={light === l} onPress={() => setLight(l)} />
            ))}
          </Row>
          <T variant="small">{LIGHT_LABEL[light].hint}</T>
        </View>
        <Row>
          <Chip label="Indoors" selected={indoor} onPress={() => setIndoor(true)} />
          <Chip label="Outdoors" selected={!indoor} onPress={() => setIndoor(false)} />
        </Row>
        <Button title="Add place" disabled={!name.trim()} onPress={add} />
      </Card>
    </Screen>
  );
}
