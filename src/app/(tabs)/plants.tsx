import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Empty, Field, PlantAvatar, Row, Screen, T } from '@/components/ui';
import { describeDue } from '@/lib/schedule';
import type { Plant } from '@/lib/types';
import { useGarden } from '@/state/garden';
import { LIGHT_LABEL, space, usePalette } from '@/theme';

export default function PlantsScreen() {
  const c = usePalette();
  const { data, photoUrl } = useGarden();
  const [query, setQuery] = useState('');
  const now = new Date();

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (p: Plant) =>
      !q || p.nickname.toLowerCase().includes(q) || p.speciesName.toLowerCase().includes(q);
    const result = data.sites.map((site) => ({
      key: site.id,
      title: site.name,
      subtitle: LIGHT_LABEL[site.light].label + (site.indoor ? '' : ' · outdoors'),
      plants: data.plants.filter((p) => p.siteId === site.id && match(p)),
    }));
    const homeless = data.plants.filter(
      (p) => (!p.siteId || !data.sites.some((s) => s.id === p.siteId)) && match(p),
    );
    if (homeless.length) result.push({ key: 'none', title: 'No place set', subtitle: '', plants: homeless });
    return result.filter((s) => s.plants.length > 0 || !q);
  }, [data.plants, data.sites, query]);

  const nextWater = (plantId: string) =>
    data.schedules.find((s) => s.plantId === plantId && s.task === 'water' && s.enabled);

  return (
    <Screen safeTop>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="title">Plants</T>
        <Button title="Add" small onPress={() => router.push('/add-plant')} />
      </Row>

      {data.plants.length === 0 ? (
        <Empty
          title="Your jungle starts here"
          body="Add plants and group them by the room or window they live in."
          action={<Button title="Add a plant" onPress={() => router.push('/add-plant')} />}
        />
      ) : (
        <>
          <Field
            label="Search"
            placeholder="Name or species"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {sections.map((section) => (
            <View key={section.key} style={{ gap: space.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="label">{section.title}</T>
                {section.subtitle ? <T variant="small">{section.subtitle}</T> : null}
              </Row>
              {section.plants.length === 0 ? (
                <T variant="small">No plants here yet.</T>
              ) : (
                <Card style={{ paddingVertical: space.xs, gap: 0 }}>
                  {section.plants.map((p, i) => {
                    const w = nextWater(p.id);
                    return (
                      <Pressable
                        key={p.id}
                        accessibilityRole="link"
                        onPress={() => router.push({ pathname: '/plant/[id]', params: { id: p.id } })}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space.md,
                          paddingVertical: space.md,
                          borderTopWidth: i === 0 ? 0 : 0.5,
                          borderColor: c.border,
                          opacity: pressed ? 0.6 : 1,
                        })}>
                        <PlantAvatar uri={photoUrl(p.photo)} name={p.nickname} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <T variant="heading" numberOfLines={1} style={{ fontSize: 16 }}>
                            {p.nickname}
                          </T>
                          {p.speciesName && p.speciesName !== p.nickname ? (
                            <T variant="small" numberOfLines={1}>
                              {p.speciesName}
                            </T>
                          ) : null}
                        </View>
                        {w ? <T variant="small">Water {describeDue(w, now).toLowerCase()}</T> : null}
                      </Pressable>
                    );
                  })}
                </Card>
              )}
            </View>
          ))}
          <Button title="Manage places" kind="ghost" onPress={() => router.push('/sites')} />
        </>
      )}
    </Screen>
  );
}
