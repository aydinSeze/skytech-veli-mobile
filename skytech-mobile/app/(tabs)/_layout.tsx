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

  // İlk yüklemede ve periyodik olarak kontrol et
  useEffect(() => {
    checkForNewNews();

    // Her 30 saniyede bir kontrol et
    const interval = setInterval(() => {
      checkForNewNews();
    }, 30000);

    // Real-time subscription
    const channel = supabase
      .channel('tab-news-updates')
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
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [checkForNewNews]);

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
          tabBarIcon: ({ color, size }) => <ShoppingBag size={size} color={color} />,
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

