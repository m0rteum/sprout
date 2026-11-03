import { useState } from 'react';

import { Button, Card, Chip, Field, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/state/auth';
import { useGarden } from '@/state/garden';

export default function HouseholdScreen() {
  const auth = useAuth()!;
  const { setPrefs } = useGarden();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('Our plants');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await setPrefs({ displayName: displayName.trim() });
      if (mode === 'create') await auth.createHousehold(householdName.trim(), displayName.trim());
      else await auth.joinHousehold(code.trim(), displayName.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <T variant="muted">
        A household is the shared garden. One of you creates it, the other joins with its invite code.
      </T>
      <Row>
        <Chip label="Start a household" selected={mode === 'create'} onPress={() => setMode('create')} />
        <Chip label="Join with a code" selected={mode === 'join'} onPress={() => setMode('join')} />
      </Row>
      <Card>
        <Field label="Your name" value={displayName} onChangeText={setDisplayName} placeholder="First name" />
        {mode === 'create' ? (
          <Field label="Household name" value={householdName} onChangeText={setHouseholdName} />
        ) : (
          <Field
            label="Invite code"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="8 letters and numbers"
          />
        )}
        {error ? <T variant="small">{error}</T> : null}
        <Button
          title={mode === 'create' ? 'Create household' : 'Join household'}
          loading={busy}
          disabled={!displayName.trim() || (mode === 'create' ? !householdName.trim() : code.trim().length < 6)}
          onPress={submit}
        />
        <Button title="Sign out" kind="ghost" onPress={() => void auth.signOut()} />
      </Card>
    </Screen>
  );
}
