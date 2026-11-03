import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * The image picker hands back a URI in a cache folder the OS may clear.
 * Copy it into the app's documents folder so it sticks around.
 */
export function persistPhoto(uri: string): string {
  if (Platform.OS === 'web') return uri;
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  const dest = new File(dir, `${randomUUID()}.jpg`);
  new File(uri).copySync(dest);
  return dest.uri;
}

export async function readPhotoBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return res.arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

/** Values that are already displayable as-is. */
export function isDirectUri(value: string): boolean {
  return /^(file|https?|blob|data|content|ph|assets-library):/.test(value);
}
