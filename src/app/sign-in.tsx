import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/state/auth';
import { space, usePalette } from '@/theme';

export default function SignInScreen() {
  const c = usePalette();
  const auth = useAuth()!;
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'in') await auth.signIn(email.trim(), password);
      else if ((await auth.signUp(email.trim(), password)) === 'check-email') {
        setMessage('Check your email to confirm your account, then sign in.');
        setMode('in');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen safeTop>
      <View style={{ gap: space.xs, marginTop: space.xxl }}>
        <T variant="title" color={c.primary}>
          Sprout
        </T>
        <T variant="muted">Plant care for two.</T>
      </View>
      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          textContentType={mode === 'in' ? 'password' : 'newPassword'}
        />
        {message ? <T variant="small">{message}</T> : null}
        <Button
          title={mode === 'in' ? 'Sign in' : 'Create account'}
          loading={busy}
          disabled={!email.trim() || password.length < 6}
          onPress={submit}
        />
        <Button
          title={mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
          kind="ghost"
          onPress={() => setMode(mode === 'in' ? 'up' : 'in')}
        />
      </Card>
    </Screen>
  );
}
