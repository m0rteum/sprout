import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform } from 'react-native';

import { notify } from '@/lib/confirm';

import { OptionsSheet } from './options-sheet';
import { Button } from './ui';

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.6,
  allowsEditing: true,
  aspect: [1, 1],
};

async function fromCamera(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    notify('Camera access needed', 'Allow camera access in Settings to take plant photos.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync(OPTIONS);
  return res.canceled ? null : (res.assets[0]?.uri ?? null);
}

async function fromLibrary(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync(OPTIONS);
  return res.canceled ? null : (res.assets[0]?.uri ?? null);
}

/** "Add photo" button that offers camera or library. */
export function PhotoButton({
  label,
  onPicked,
  kind = 'secondary',
  small,
}: {
  label: string;
  onPicked: (uri: string) => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const run = async (pick: () => Promise<string | null>) => {
    const uri = await pick();
    if (uri) onPicked(uri);
  };

  return (
    <>
      <Button
        title={label}
        kind={kind}
        small={small}
        onPress={() => (Platform.OS === 'web' ? void run(fromLibrary) : setOpen(true))}
      />
      <OptionsSheet
        visible={open}
        title={label}
        onClose={() => setOpen(false)}
        options={[
          { label: 'Take a photo', run: () => void run(fromCamera) },
          { label: 'Choose from library', run: () => void run(fromLibrary) },
        ]}
      />
    </>
  );
}
