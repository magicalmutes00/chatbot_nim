import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import type { CollectionReference } from '@react-native-firebase/firestore';
import type { Chat, ChatMessage, MessageRole } from '../types/chat';

const db = () => getFirestore();

function chatsRef(uid: string): CollectionReference {
  return collection(db(), 'users', uid, 'chats');
}

function messagesRef(uid: string, chatId: string): CollectionReference {
  return collection(db(), 'users', uid, 'chats', chatId, 'messages');
}

export async function createChat(uid: string, model: string, initialTitle = 'New chat'): Promise<string> {
  const now = serverTimestamp();
  const ref = await addDoc(chatsRef(uid), {
    title: initialTitle,
    model,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function renameChat(uid: string, chatId: string, title: string): Promise<void> {
  await updateDoc(doc(chatsRef(uid), chatId), { title, updatedAt: serverTimestamp() });
}

export async function deleteChat(uid: string, chatId: string): Promise<void> {
  // Firestore batches cap at 500 operations, so delete messages in chunks
  // (Firestore doesn't cascade-delete subcollections).
  const CHUNK_SIZE = 400;
  let snap = await getDocs(query(messagesRef(uid, chatId), limit(CHUNK_SIZE)));
  while (!snap.empty) {
    const batch = writeBatch(db());
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    snap = await getDocs(query(messagesRef(uid, chatId), limit(CHUNK_SIZE)));
  }
  // Chat doc goes last, only after its messages are gone.
  await deleteDoc(doc(chatsRef(uid), chatId));
}

export function subscribeToChats(uid: string, onChange: (chats: Chat[]) => void): () => void {
  return onSnapshot(query(chatsRef(uid), orderBy('updatedAt', 'desc')), (snap) => {
    const chats: Chat[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        model: data.model,
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt),
      };
    });
    onChange(chats);
  });
}

export function subscribeToMessages(
  uid: string,
  chatId: string,
  onChange: (messages: ChatMessage[]) => void,
): () => void {
  return onSnapshot(query(messagesRef(uid, chatId), orderBy('createdAt', 'asc')), (snap) => {
    const messages: ChatMessage[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        role: data.role as MessageRole,
        content: data.content,
        reasoningContent: data.reasoningContent,
        model: data.model,
        createdAt: toMillis(data.createdAt),
      };
    });
    onChange(messages);
  });
}

export async function addMessage(
  uid: string,
  chatId: string,
  message: Omit<ChatMessage, 'id' | 'createdAt'>,
): Promise<void> {
  const now = serverTimestamp();
  await addDoc(messagesRef(uid, chatId), { ...message, createdAt: now });
  await updateDoc(doc(chatsRef(uid), chatId), { updatedAt: now });
}

/** Sets the chat title from the first user message, truncated for display. */
export async function maybeSetTitleFromFirstMessage(uid: string, chatId: string, firstUserMessage: string) {
  const title = firstUserMessage.trim().slice(0, 60) || 'New chat';
  await updateDoc(doc(chatsRef(uid), chatId), { title });
}

function toMillis(ts: Timestamp | undefined): number {
  return ts ? ts.toMillis() : Date.now();
}
