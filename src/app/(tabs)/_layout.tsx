import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { usePalette } from '@/theme';

const icons = {
  today: Platform.OS === 'ios' ? { sf: 'drop.fill' as const } : { src: require('@/assets/images/tabIcons/today.png') },
  plants: Platform.OS === 'ios' ? { sf: 'leaf.fill' as const } : { src: require('@/assets/images/tabIcons/plants.png') },
  settings: Platform.OS === 'ios' ? { sf: 'gearshape.fill' as const } : { src: require('@/assets/images/tabIcons/settings.png') },
};

export default function TabLayout() {
  const c = usePalette();
  return (
    <NativeTabs
      backgroundColor={c.surface}
      indicatorColor={c.primarySoft}
      tintColor={c.primary}
      labelStyle={{ selected: { color: c.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...icons.today} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plants">
        <NativeTabs.Trigger.Label>Plants</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...icons.plants} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...icons.settings} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
