import { Platform } from 'react-native';

import { matchScientificName, type Species } from '@/data/species';

/**
 * Photo identification through the Pl@ntNet API (free tier for personal use).
 * Get a key at https://my.plantnet.org and set EXPO_PUBLIC_PLANTNET_API_KEY.
 */
const apiKey = process.env.EXPO_PUBLIC_PLANTNET_API_KEY;

export const isIdentifyConfigured = Boolean(apiKey);

export interface IdentifyResult {
  scientificName: string;
  commonName: string | null;
  score: number;
  match: Species | undefined;
}

interface PlantNetResponse {
  results?: {
    score: number;
    species: { scientificNameWithoutAuthor: string; commonNames?: string[] };
  }[];
}

export async function identifyPlant(photoUri: string): Promise<IdentifyResult[]> {
  if (!apiKey) throw new Error('Plant ID is not set up. Add EXPO_PUBLIC_PLANTNET_API_KEY.');

  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(photoUri)).blob();
    form.append('images', blob, 'plant.jpg');
  } else {
    // React Native's FormData accepts a { uri, name, type } file descriptor.
    form.append('images', { uri: photoUri, name: 'plant.jpg', type: 'image/jpeg' } as never);
  }
  form.append('organs', 'auto');

  const res = await fetch(
    `https://my-api.plantnet.org/v2/identify/all?nb-results=5&api-key=${encodeURIComponent(apiKey)}`,
    { method: 'POST', body: form },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Plant ID failed (${res.status})`);

  const json = (await res.json()) as PlantNetResponse;
  return (json.results ?? []).map((r) => ({
    scientificName: r.species.scientificNameWithoutAuthor,
    commonName: r.species.commonNames?.[0] ?? null,
    score: r.score,
    match: matchScientificName(r.species.scientificNameWithoutAuthor),
  }));
}
