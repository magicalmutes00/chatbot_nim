import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { NIM_MODELS, DEFAULT_MODEL_ID } from '../config/nimModels';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Signed in as</Text>
      <Text style={styles.value}>{user?.email}</Text>

      <Text style={[styles.label, { marginTop: 24 }]}>Default model</Text>
      <Text style={styles.value}>
        {NIM_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)?.label ?? DEFAULT_MODEL_ID}
      </Text>

      <View style={{ marginTop: 32 }}>
        <Button title="Log out" onPress={() => signOut()} color="#c0392b" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  label: { fontSize: 12, color: '#888', textTransform: 'uppercase' },
  value: { fontSize: 16, marginTop: 4 },
});
