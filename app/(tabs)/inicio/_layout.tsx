import { Stack } from 'expo-router';

export default function InicioLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sesion/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
