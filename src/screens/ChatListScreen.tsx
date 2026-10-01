import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { subscribeToChats, createChat, deleteChat } from '../services/firestoreChats';
import { DEFAULT_MODEL_ID } from '../config/nimModels';
import { radius, spacing, type ThemeColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import type { Chat } from '../types/chat';

type Props = NativeStackScreenProps<MainStackParamList, 'ChatList'>;

const MENU_WIDTH = 280;

export default function ChatListScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuX = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, query]);

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
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable
          hitSlop={10}
          onPress={openMenu}
          accessibilityLabel="Open menu"
          style={styles.iconBtn}
        >
          <Text style={styles.menuIcon}>{'☰'}</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>Trisentric AI</Text>
        <View style={styles.iconBtnSpacer} />
      </View>

      <LinearGradient colors={colors.heroGradient} style={styles.hero}>
        <Text style={styles.heroTitle}>Welcome back</Text>
        <View style={styles.heroStatusRow}>
          <Animated.View style={[styles.statusDot, { opacity: pulse }]} />
          <Text style={styles.heroStatus}>Connected to NVIDIA NIM</Text>
        </View>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search chats"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          selectionColor={colors.accent}
        />
      </View>

      <Text style={styles.sectionLabel}>Recent chats</Text>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyGlyph}>{'✦'}</Text>
            <Text style={styles.emptyTitle}>
              {query ? 'No matching chats' : 'No conversations yet'}
            </Text>
            <Text style={styles.emptyHint}>
              {query ? 'Try a different search.' : 'Start your first chat with an NVIDIA NIM model.'}
            </Text>
            {!query && (
              <View style={styles.emptyBtn}>
                <Button title="Start chatting" onPress={handleNewChat} />
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.chatRow, pressed && { opacity: 0.6 }]}
            onPress={() => navigation.navigate('Chat', { chatId: item.id })}
            onLongPress={() => handleDelete(item.id)}
          >
            <View style={styles.chatRowText}>
              <Text style={styles.chatRowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.chatRowMeta}>{relativeTime(item.updatedAt)}</Text>
            </View>
            <Text style={styles.chatRowChevron}>{'›'}</Text>
          </Pressable>
        )}
      />

      <Pressable
        onPress={handleNewChat}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.75 }]}
        accessibilityLabel="New chat"
      >
        <LinearGradient
          colors={colors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.fabIcon}>{'+'}</Text>
      </Pressable>

      {menuOpen && <Pressable style={styles.backdrop} onPress={closeMenu} />}
      <Animated.View
        style={[styles.menu, { transform: [{ translateX: menuX }] }]}
        pointerEvents={menuOpen ? 'auto' : 'none'}
      >
        <LinearGradient
          colors={colors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.menuOrb}
        >
          <Text style={styles.menuOrbText}>{'T'}</Text>
        </LinearGradient>
        <Text style={styles.menuBrand}>Trisentric AI</Text>
        <Text style={styles.menuUser} numberOfLines={1}>
          {user?.email ?? 'Signed in'}
        </Text>
        <View style={styles.menuDivider} />

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}
          onPress={() => {
            closeMenu();
            handleNewChat();
          }}
        >
          <Text style={[styles.menuItemText, { color: colors.accent2 }]}>{'+  New chat'}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}
          onPress={() => {
            closeMenu();
            navigation.navigate('Settings');
          }}
        >
          <Text style={[styles.menuItemText, { color: colors.textSecondary }]}>Settings</Text>
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgBase },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.xl + spacing.sm,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    iconBtnSpacer: { width: 34 },
    menuIcon: { color: colors.textPrimary, fontSize: 22, lineHeight: 26 },
    topBarTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
      flex: 1,
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    hero: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg },
    heroTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
    heroStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm + 1 },
    statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent2, marginRight: 7 },
    heroStatus: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '500' },
    searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    search: {
      color: colors.textPrimary,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: radius.pill,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 14,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      paddingHorizontal: spacing.lg + 2,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
    },
    listContent: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: 120 },
    chatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.md + 2,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      marginBottom: spacing.sm,
      shadowColor: '#050b1c',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    chatRowText: { flex: 1 },
    chatRowTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    chatRowMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
    chatRowChevron: { color: colors.accent, fontSize: 20, fontWeight: '700', marginLeft: spacing.sm },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl * 2 },
    emptyGlyph: { color: colors.accent2, fontSize: 34, marginBottom: spacing.md },
    emptyTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '800', textAlign: 'center' },
    emptyHint: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      marginTop: spacing.sm,
      lineHeight: 19,
    },
    emptyBtn: { marginTop: spacing.xl },
    fab: {
      position: 'absolute',
      right: spacing.xl,
      bottom: spacing.xl,
      width: 58,
      height: 58,
      borderRadius: 29,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.accent,
      shadowOpacity: 0.55,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    fabIcon: { color: colors.textPrimary, fontSize: 30, lineHeight: 34, fontWeight: '400', marginTop: -2 },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    menu: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: MENU_WIDTH,
      backgroundColor: colors.bgBaseAlt,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.borderSubtle,
      paddingTop: spacing.xxl * 2,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.md,
      elevation: 12,
    },
    menuOrb: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
      marginBottom: spacing.md,
    },
    menuOrbText: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    menuBrand: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
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
      backgroundColor: colors.borderSubtle,
      marginVertical: spacing.md,
    },
    menuItem: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
    },
    menuItemText: { fontSize: 15, fontWeight: '600' },
  });
