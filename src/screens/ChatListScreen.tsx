import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Pressable, StyleSheet, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToChats, createChat, deleteChat } from '../services/firestoreChats';
import { DEFAULT_MODEL_ID, getModelById } from '../config/nimModels';
import { GlassSurface } from '../components/GlassSurface';
import { GlassButton } from '../components/GlassButton';
import { colors, radius, spacing } from '../theme/glass';
import type { Chat } from '../types/chat';

type Props = NativeStackScreenProps<MainStackParamList, 'ChatList'>;

export default function ChatListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToChats(user.uid, setChats);
    return unsubscribe;
  }, [user]);

  const handleNewChat = async () => {
    if (!user) return;
    const chatId = await createChat(user.uid, DEFAULT_MODEL_ID);
    navigation.navigate('Chat', { chatId });
  };

  const handleDelete = (chatId: string) => {
    if (!user) return;
    Alert.alert('Delete chat?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteChat(user.uid, chatId) },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyHint}>Tap “New chat” to start.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('Chat', { chatId: item.id })}
            onLongPress={() => handleDelete(item.id)}
            android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
          >
            <GlassSurface radius={radius.md} tone="light" shadow={false}>
              <View style={styles.row}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {getModelById(item.model)?.label ?? item.model} · {relativeTime(item.updatedAt)}
                </Text>
              </View>
            </GlassSurface>
          </Pressable>
        )}
      />

      <View style={styles.fabWrap}>
        <GlassButton title="+ New chat" onPress={handleNewChat} variant="primary" />
      </View>
    </View>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingTop: spacing.xl * 4, paddingBottom: 120 },
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  emptyHint: { color: colors.textSecondary, marginTop: 6 },
  fabWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
});
