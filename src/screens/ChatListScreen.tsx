import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Pressable, StyleSheet, Button, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToChats, createChat, deleteChat } from '../services/firestoreChats';
import { DEFAULT_MODEL_ID, getModelById } from '../config/nimModels';
import type { Chat } from '../types/chat';

type Props = NativeStackScreenProps<MainStackParamList, 'ChatList'>;

export default function ChatListScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToChats(user.uid, setChats);
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => <Button title="Settings" onPress={() => navigation.navigate('Settings')} />,
    });
  }, [navigation]);

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
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No chats yet — start a new one.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('Chat', { chatId: item.id })}
            onLongPress={() => handleDelete(item.id)}
          >
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.meta}>
              {getModelById(item.model)?.label ?? item.model} · {new Date(item.updatedAt).toLocaleString()}
            </Text>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Button title="+ New chat" onPress={handleNewChat} />
        <Button title="Log out" onPress={() => signOut()} color="#999" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 40, color: '#888' },
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 12, color: '#888', marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
});
