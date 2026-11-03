import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { createLocalDataSource } from '@/lib/datasource/local';
import { createSupabaseDataSource } from '@/lib/datasource/supabase';
import { isCloudConfigured, supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/state/auth';
import { GardenProvider } from '@/state/garden';
import { usePalette } from '@/theme';

SplashScreen.preventAutoHideAsync();

type Phase = 'loading' | 'auth' | 'household' | 'app';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = usePalette();
  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: { ...navTheme.colors, background: c.bg, card: c.bg, primary: c.primary, text: c.text },
      }}>
      {isCloudConfigured ? (
        <AuthProvider>
          <CloudRoot />
        </AuthProvider>
      ) : (
        <LocalRoot />
      )}
    </ThemeProvider>
  );
}

function LocalRoot() {
  const source = useMemo(() => createLocalDataSource(), []);
  return (
    <GardenProvider source={source}>
      <AppStack phase="app" />
    </GardenProvider>
  );
}

function CloudRoot() {
  const auth = useAuth()!;
  const householdId = auth.household?.id ?? null;
  const source = useMemo(
    () => (householdId && supabase ? createSupabaseDataSource(supabase, householdId) : null),
    [householdId],
  );
  const phase: Phase = !auth.ready
    ? 'loading'
    : !auth.session
      ? 'auth'
      : !householdId
        ? 'household'
        : 'app';
  return (
    <GardenProvider key={householdId ?? 'none'} source={source}>
      <AppStack phase={phase} />
    </GardenProvider>
  );
}

function AppStack({ phase }: { phase: Phase }) {
  const c = usePalette();

  useEffect(() => {
    if (phase !== 'loading') void SplashScreen.hideAsync();
  }, [phase]);

  if (phase === 'loading') return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.primary,
        headerTitleStyle: { color: c.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Protected guard={phase === 'auth'}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'household'}>
        <Stack.Screen name="household" options={{ title: 'Your household' }} />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'app'}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plant/[id]" options={{ title: '' }} />
        <Stack.Screen name="add-plant" options={{ presentation: 'modal', title: 'Add a plant' }} />
        <Stack.Screen name="sites" options={{ title: 'Places' }} />
      </Stack.Protected>
    </Stack>
  );
}
