import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { Button, Card, Chip, Field, Row, Screen, T } from '@/components/ui';
import { notify } from '@/lib/confirm';
import { requestReminderPermission } from '@/lib/notifications';
import { isIdentifyConfigured } from '@/lib/plantnet';
import { addDays, startOfDay } from '@/lib/schedule';
import { useAuth } from '@/state/auth';
import { useGarden } from '@/state/garden';
import { space, usePalette } from '@/theme';

const pad = (n: number) => String(n).padStart(2, '0');

export default function SettingsScreen() {
  const c = usePalette();
  const { prefs, setPrefs, sourceKind, data } = useGarden();
  const auth = useAuth();

  const onVacation = prefs.vacationUntil && new Date(prefs.vacationUntil) > new Date();
  const away = (days: number) =>
    setPrefs({ vacationUntil: startOfDay(addDays(new Date(), days)).toISOString() });

  const shiftHour = (delta: number) =>
    setPrefs({ reminderHour: (prefs.reminderHour + delta + 24) % 24 });

  return (
    <Screen safeTop>
      <T variant="title">Settings</T>

      <View style={{ gap: space.sm }}>
        <T variant="label">Household</T>
        {sourceKind === 'supabase' && auth?.household ? (
          <Card>
            <T variant="heading">{auth.household.name}</T>
            <T variant="muted">
              {auth.members.map((m) => m.displayName || 'Someone').join(' & ')} · {data.plants.length} plants
            </T>
            <T variant="small">Invite code</T>
            <T style={{ fontSize: 26, fontWeight: '800', letterSpacing: 4 }}>{auth.household.inviteCode}</T>
            <T variant="small">
              Your partner signs up in Sprout, picks “Join with a code” and enters this code. You’ll both see the
              same plants, and when one of you waters, it’s checked off for both.
            </T>
            <Row>
              {Platform.OS !== 'web' ? (
                <Button
                  title="Share code"
                  kind="secondary"
                  small
                  onPress={() =>
                    Share.share({ message: `Join our plants on Sprout with code ${auth.household!.inviteCode}` })
                  }
                />
              ) : null}
              <Button title="Sign out" kind="ghost" small onPress={() => void auth.signOut()} />
            </Row>
          </Card>
        ) : (
          <Card>
            <T variant="heading">Only on this device</T>
            <T variant="muted">
              Sprout is saving plants on this phone. To share them with someone, connect a free Supabase project.
              The README has step-by-step setup.
            </T>
          </Card>
        )}
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">You</T>
        <Card>
          <NameField
            key={prefs.displayName}
            initial={prefs.displayName}
            onSave={(displayName) => void setPrefs({ displayName })}
          />
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">Reminders</T>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T>Daily reminder</T>
            <Row gap={space.xs}>
              <Button title="−" kind="secondary" small onPress={() => void shiftHour(-1)} />
              <T style={{ minWidth: 64, textAlign: 'center', fontWeight: '700' }}>
                {pad(prefs.reminderHour)}:{pad(prefs.reminderMinute)}
              </T>
              <Button title="+" kind="secondary" small onPress={() => void shiftHour(1)} />
            </Row>
          </Row>
          {Platform.OS === 'web' ? (
            <T variant="small">Reminders work in the iPhone and Android app, not the browser.</T>
          ) : (
            <Button
              title="Allow notifications"
              kind="secondary"
              small
              onPress={async () => {
                const ok = await requestReminderPermission();
                notify(ok ? 'Reminders are on' : 'Notifications are off', ok ? undefined : 'Turn them on in your phone’s Settings app.');
              }}
            />
          )}
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">Away mode</T>
        <Card>
          <T variant="muted">
            {onVacation
              ? `Reminders paused until ${new Date(prefs.vacationUntil!).toLocaleDateString()}.`
              : 'Going away? Pause reminders so they don’t pile up.'}
          </T>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip label="3 days" onPress={() => void away(3)} />
            <Chip label="1 week" onPress={() => void away(7)} />
            <Chip label="2 weeks" onPress={() => void away(14)} />
            {onVacation ? (
              <Chip label="I'm back" color={c.accent} selected onPress={() => void setPrefs({ vacationUntil: null })} />
            ) : null}
          </Row>
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">Seasons</T>
        <Card>
          <T variant="muted">Sprout waters less and skips fertilizer during your winter.</T>
          <Row>
            <Chip label="Northern hemisphere" selected={prefs.hemisphere === 'north'} onPress={() => void setPrefs({ hemisphere: 'north' })} />
            <Chip label="Southern" selected={prefs.hemisphere === 'south'} onPress={() => void setPrefs({ hemisphere: 'south' })} />
          </Row>
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label">Garden</T>
        <Card>
          <Button title="Manage places" kind="secondary" onPress={() => router.push('/sites')} />
          <T variant="small">
            Photo plant ID: {isIdentifyConfigured ? 'on (Pl@ntNet)' : 'off. Add a Pl@ntNet key to turn it on.'}
          </T>
        </Card>
      </View>
    </Screen>
  );
}

function NameField({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const save = () => {
    if (name.trim() !== initial) onSave(name.trim());
  };
  return (
    <Field
      label="Your name"
      placeholder="Shows up in plant history"
      value={name}
      onChangeText={setName}
      onBlur={save}
      onSubmitEditing={save}
    />
  );
}
