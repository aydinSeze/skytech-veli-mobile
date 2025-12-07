import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { StudentProvider, useStudent } from '../context/StudentContext';

function RootLayoutNav() {
  const { student } = useStudent();
  const router = useRouter();
  const segments = useSegments();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const isLoginPage = segments[0] === 'login';
    const isMenuPage = segments[0] === 'menu';

    // Eğer giriş yapmamışsa ve tabs veya menu sayfasındaysa login'e yönlendir
    if (!student && (inAuthGroup || isMenuPage)) {
      router.replace('/login');
    } 
    // Eğer giriş yapmışsa ve login sayfasındaysa ana sayfaya yönlendir
    else if (student && isLoginPage) {
      router.replace('/(tabs)');
    }
  }, [student, segments, isMounted, router]);

  if (!isMounted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="menu" />
      <Stack.Screen name="campaign-detail" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <StudentProvider>
      <RootLayoutNav />
    </StudentProvider>
  );
}

