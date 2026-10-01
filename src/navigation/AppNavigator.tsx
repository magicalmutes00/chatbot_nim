import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Text, View, StyleSheet } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { useAuth } from '../contexts/AuthContext'
import { Background } from '../components/Background'
import { TypingDots } from '../components/TypingDots'
import { useTheme } from '../theme/ThemeContext'
import LoginScreen from '../screens/LoginScreen'
import SignupScreen from '../screens/SignupScreen'
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen'
import ChatListScreen from '../screens/ChatListScreen'
import ChatScreen from '../screens/ChatScreen'
import SettingsScreen from '../screens/SettingsScreen'

export type AuthStackParamList = {
  Login: undefined
  Signup: undefined
  ForgotPassword: undefined
}

export type MainStackParamList = {
  ChatList: undefined
  Chat: { chatId: string }
  Settings: undefined
}

const authStack = createNativeStackNavigator<AuthStackParamList>()

const mainStack = createNativeStackNavigator<MainStackParamList>()

const stylesLoader = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbText: { color: '#ffffff', fontSize: 30, fontWeight: '800' },
  brand: { marginTop: 16, marginBottom: 10, fontSize: 13, fontWeight: '700', letterSpacing: 3 },
})

export default function AppNavigator() {
  const { user, initializing } = useAuth()
  const { colors } = useTheme()

  if (initializing) {
    return (
      <Background>
        <View style={stylesLoader.loadingWrap}>
          <LinearGradient
            colors={colors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={stylesLoader.orb}
          >
            <Text style={stylesLoader.orbText}>{'T'}</Text>
          </LinearGradient>
          <Text style={[stylesLoader.brand, { color: colors.textPrimary }]}>TRISENTRIC AI</Text>
          <TypingDots color={colors.accent2} />
        </View>
      </Background>
    )
  }

  return (
    <NavigationContainer>
      {user ? (
        <mainStack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <mainStack.Screen
            name="ChatList"
            component={ChatListScreen}
          />
          <mainStack.Screen
            name="Chat"
            component={ChatScreen}
          />
          <mainStack.Screen
            name="Settings"
            component={SettingsScreen}
          />
        </mainStack.Navigator>
      ) : (
        <authStack.Navigator
          screenOptions={{
            headerShown: true,
            title: 'Trisentric AI',
            headerStyle: { backgroundColor: colors.bgBaseAlt },
            headerTitleStyle: { color: colors.textPrimary },
            headerTintColor: colors.textPrimary,
          }}
        >
          <authStack.Screen
            name="Login"
            component={LoginScreen}
          />
          <authStack.Screen
            name="Signup"
            component={SignupScreen}
          />
          <authStack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
          />
        </authStack.Navigator>
      )}
    </NavigationContainer>
  )
}