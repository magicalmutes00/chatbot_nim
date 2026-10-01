import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, Text, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { Background } from '../components/Background'
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

export default function AppNavigator() {
  const { user, initializing } = useAuth()
  const { colors } = useTheme()

  if (initializing) {
    return (
      <Background>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.textPrimary, marginTop: 16, letterSpacing: 2 }}>TRISENTRIC AI</Text>
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