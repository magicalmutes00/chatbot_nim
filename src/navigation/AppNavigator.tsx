import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, Text, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { GlassBackground } from '../components/GlassBackground'
import { colors } from '../theme/glass'
import LoginScreen from '../screens/LoginScreen'
import SignupScreen from '../screens/SignupScreen'
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen'
import ChatListScreen from '../screens/ChatListScreen'
import ChatScreen from '../screens/ChatScreen'

export type AuthStackParamList = {
  Login: undefined
  Signup: undefined
  ForgotPassword: undefined
}

export type MainStackParamList = {
  ChatList: undefined
  Chat: { chatId: string }
}

const authStack = createNativeStackNavigator<AuthStackParamList>()

const mainStack = createNativeStackNavigator<MainStackParamList>()

export default function AppNavigator() {
  const { user, initializing } = useAuth()

  if (initializing) {
    return (
      <GlassBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.textPrimary, marginTop: 16, letterSpacing: 2 }}>NIMCHAT</Text>
        </View>
      </GlassBackground>
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
        </mainStack.Navigator>
      ) : (
        <authStack.Navigator
          screenOptions={{
            headerShown: true,
            title: 'NIMCHAT',
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