import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <StatusBar style="dark" backgroundColor={Colors.bg} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
        <Stack.Screen name="(auth)"             options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)"              options={{ animation: 'fade' }} />
        <Stack.Screen name="workspace-picker"   options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="chat"               options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="onboarding"         options={{ animation: 'fade' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
