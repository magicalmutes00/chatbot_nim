import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToChats, createChat, deleteChat } from '../services/firestoreChats';
import { DEFAULT_MODEL_ID } from '../config/nimModels';
import { colors, radius, spacing } from '../theme/glass';
import type { Chat } from '../types/chat';

type Props = NativeStackScreenProps<MainStackParamList, 'ChatList'>;

const MENU_WIDTH = 280;

export default function ChatListScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuX = useRef(new Animated.Value(-MENU_WIDTH)).current;

  const openMenu = () => {
    setMenuOpen(true);
    Animated.timing(menuX, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuX, {
      toValue: -MENU_WIDTH,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMenuOpen(false);
    });
  };

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
      <View style={styles.topBar}>
        <Pressable hitSlop={10} onPress={openMenu} accessibilityLabel="Open menu">
          <Text style={styles.menuIcon}>{'☰'}</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>Trisentric AI</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Welcome back</Text>
        <Text style={styles.heroHint}>Start a new conversation from the + button, or open a past chat from the menu.</Text>
      </View>

      <Pressable
        onPress={handleNewChat}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.75 }]}
        accessibilityLabel="New chat"
      >
        <BlurView
          blurType="light"
          blurAmount={35}
          reducedTransparencyFallbackColor="#ffffff"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.accentSoft }]} />
        <Text style={styles.fabIcon}>{'+'}</Text>
      </Pressable>

      {menuOpen && <Pressable style={styles.backdrop} onPress={closeMenu} />}
      <Animated.View
        style={[styles.menu, { transform: [{ translateX: menuX }] }]}
        pointerEvents={menuOpen ? 'auto' : 'none'}
      >
        <Text style={styles.menuBrand}>Trisentric AI</Text>
        <Text style={styles.menuUser} numberOfLines={1}>
          {user?.email ?? 'Signed in'}
        </Text>
        <View style={styles.menuDivider} />

        <Text style={styles.menuSection}>Chats</Text>
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          ListEmptyComponent={
            <Text style={styles.menuEmpty}>No conversations yet</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.chatItem, pressed && { opacity: 0.6 }]}
              onPress={() => {
                closeMenu();
                navigation.navigate('Chat', { chatId: item.id });
              }}
              onLongPress={() => handleDelete(item.id)}
            >
              <Text style={styles.chatItemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.chatItemMeta}>{relativeTime(item.updatedAt)}</Text>
            </Pressable>
          )}
        />

        <View style={styles.menuDivider} />

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}
          onPress={() => {
            closeMenu();
            handleNewChat();
          }}
        >
          <Text style={[styles.menuItemText, { color: colors.accent }]}>{'+  New chat'}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}
          onPress={() => {
            closeMenu();
            signOut();
          }}
        >
          <Text style={[styles.menuItemText, { color: colors.danger }]}>Sign out</Text>
        </Pressable>
      </Animated.View>
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
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl * 2 },
  heroTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '700' },
  heroHint: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xl + spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  menuIcon: { color: colors.textPrimary, fontSize: 24, lineHeight: 28 },
  topBarTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  list: { padding: spacing.lg, paddingBottom: 120 },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d1220',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabIcon: { color: colors.accent, fontSize: 30, lineHeight: 34, fontWeight: '400', marginTop: -2 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  menu: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: colors.bgBaseAlt,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.glassBorderSubtle,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    elevation: 12,
  },
  menuBrand: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
  },
  menuUser: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: spacing.sm,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.glassBorderSubtle,
    marginVertical: spacing.md,
  },
  menuItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  menuItemText: { fontSize: 15, fontWeight: '600' },
  menuSection: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  chatItem: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  chatItemTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  chatItemMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  menuEmpty: {
    color: colors.textMuted,
    fontSize: 13,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontStyle: 'italic',
  },
});
