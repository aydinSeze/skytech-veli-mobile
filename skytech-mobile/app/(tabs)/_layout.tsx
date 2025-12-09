import { Tabs } from 'expo-router';
import { Home, ShoppingBag, User, Newspaper } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import React from 'react';

const LAST_VIEWED_NEWS_KEY = '@skytech:last_viewed_news_timestamp';

export default function TabLayout() {
  const [hasNewNews, setHasNewNews] = useState(false);
  const [hasNewTransaction, setHasNewTransaction] = useState(false);

  // Yeni haber kontrolü
  const checkForNewNews = React.useCallback(async () => {
    try {
      const now = new Date().toISOString();
      
      const { data } = await supabase
        .from('announcements')
        .select('created_at')
        .eq('is_active', true)
        .eq('display_location', 'haberler')
        .lte('start_date', now)
        .gte('end_date', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const lastViewedTimestamp = await AsyncStorage.getItem(LAST_VIEWED_NEWS_KEY);
        if (lastViewedTimestamp) {
          const lastViewed = new Date(lastViewedTimestamp);
          const latestNewsDate = new Date(data.created_at);
          setHasNewNews(latestNewsDate > lastViewed);
        } else {
          setHasNewNews(true);
        }
      } else {
        setHasNewNews(false);
      }
    } catch (error) {
      console.error('Yeni haber kontrolü hatası:', error);
      setHasNewNews(false);
    }
  }, []);

  // Yeni işlem kontrolü
  const checkForNewTransaction = React.useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (!profile?.school_id) return;

      // Son görüntülenme zamanını kontrol et
      const lastViewedKey = '@skytech:last_viewed_transaction_timestamp';
      const lastViewedTimestamp = await AsyncStorage.getItem(lastViewedKey);

      const { data: latestTransaction } = await supabase
        .from('transactions')
        .select('created_at')
        .eq('school_id', profile.school_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestTransaction) {
        if (lastViewedTimestamp) {
          const lastViewed = new Date(lastViewedTimestamp);
          const latestDate = new Date(latestTransaction.created_at);
          setHasNewTransaction(latestDate > lastViewed);
        } else {
          setHasNewTransaction(true);
        }
      } else {
        setHasNewTransaction(false);
      }
    } catch (error) {
      console.error('Yeni işlem kontrolü hatası:', error);
      setHasNewTransaction(false);
    }
  }, []);

  // İlk yüklemede ve periyodik olarak kontrol et
  useEffect(() => {
    checkForNewNews();
    checkForNewTransaction();

    // Her 30 saniyede bir kontrol et
    const interval = setInterval(() => {
      checkForNewNews();
      checkForNewTransaction();
    }, 30000);

    // Real-time subscription
    const channel = supabase
      .channel('tab-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
          filter: 'display_location=eq.haberler',
        },
        () => {
          checkForNewNews();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
        },
        () => {
          checkForNewTransaction();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [checkForNewNews, checkForNewTransaction]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: '#334155',
          borderTopWidth: 1,
          paddingBottom: 8, // Alt navigasyon bar'ı hafifçe yukarı kaydır
          paddingTop: 8, // Üstten de hafif padding
          height: 65, // Sabit yükseklik (varsayılan ~60, biraz artırdık)
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'Haberler',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.iconContainer}>
              <Newspaper 
                size={size} 
                color={hasNewNews && !focused ? '#fbbf24' : color} 
              />
              {hasNewNews && (
                <View style={[
                  styles.badge,
                  { backgroundColor: '#fbbf24' }
                ]} />
              )}
            </View>
          ),
          tabBarBadge: hasNewNews ? undefined : undefined, // Badge yerine renk değişimi
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'İşlem Geçmişi',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.iconContainer}>
              <ShoppingBag 
                size={size} 
                color={hasNewTransaction && !focused ? '#10b981' : color} 
              />
              {hasNewTransaction && (
                <View style={[
                  styles.badge,
                  { backgroundColor: '#10b981' }
                ]} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
});

