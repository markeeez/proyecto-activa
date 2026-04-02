import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Página no encontrada' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Esta pantalla no existe.</Text>
        <Link href="/" style={styles.link}>
          <Text>Volver al inicio</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  link: { marginTop: 15, paddingVertical: 15 },
});
