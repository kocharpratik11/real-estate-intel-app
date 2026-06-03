import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function PortfolioLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/rent" />
      <Stack.Screen name="[id]/unit/[unitId]/index" />
    </Stack>
  );
}
