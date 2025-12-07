import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Newspaper, ExternalLink } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

interface Announcement {
  id: string;
  title: string;
  description: string;
  image_url: string;
  target_link: string;
  created_at: string;
  start_date?: string;
  end_date?: string;
  view_count?: number;
}

const LAST_VIEWED_NEWS_KEY = '@skytech:last_viewed_news_timestamp';

export default function NewsScreen() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [borderPulseAnim] = useState(new Animated.Value(1));
  const [hasNewNews, setHasNewNews] = useState(false);

  const fetchAnnouncements = React.useCallback(async () => {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .eq('display_location', 'haberler') // Sadece haberler sayfası için olanlar
        .lte('start_date', now) // Başlangıç tarihi geçmiş veya bugün
        .gte('end_date', now)   // Bitiş tarihi gelecek veya bugün
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Haber çekme hatası:', error);
        setAnnouncements([]);
        return;
      }

      const newsData = data || [];
      setAnnouncements(newsData);

      // Yeni haber kontrolü - Son görüntülenme zamanını kontrol et
      if (newsData.length > 0) {
        try {
          const lastViewedTimestamp = await AsyncStorage.getItem(LAST_VIEWED_NEWS_KEY);
          const latestNews = newsData[0]; // En yeni haber
          
          if (lastViewedTimestamp) {
            const lastViewed = new Date(lastViewedTimestamp);
            const latestNewsDate = new Date(latestNews.created_at);
            // Eğer en yeni haber, son görüntülenme zamanından daha yeni ise
            setHasNewNews(latestNewsDate > lastViewed);
          } else {
            // İlk kez açılıyorsa ve haber varsa
            setHasNewNews(newsData.length > 0);
          }
        } catch (error) {
          console.error('Yeni haber kontrolü hatası:', error);
        }
      } else {
        setHasNewNews(false);
      }
    } catch (error) {
      console.error('Haber yükleme hatası:', error);
      setAnnouncements([]);
      setHasNewNews(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Her sayfa odaklandığında haberleri yeniden çek
  useFocusEffect(
    React.useCallback(() => {
      fetchAnnouncements();

      // Real-time subscription for announcements - SADECE HABERLER İÇİN
      const announcementChannel = supabase
        .channel('news-announcements-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'announcements',
            filter: 'display_location=eq.haberler', // Sadece haberler için dinle
          },
          () => {
            fetchAnnouncements();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(announcementChannel);
      };
    }, [fetchAnnouncements])
  );

  // Sayfa görüntülendiğinde son görüntülenme zamanını kaydet
  useFocusEffect(
    React.useCallback(() => {
      const markAsViewed = async () => {
        if (announcements.length > 0) {
          try {
            await AsyncStorage.setItem(LAST_VIEWED_NEWS_KEY, new Date().toISOString());
            setHasNewNews(false); // Artık yeni haber yok
          } catch (error) {
            console.error('Görüntülenme zamanı kaydedilemedi:', error);
          }
        }
      };

      // Sayfa açıldığında 1 saniye sonra işaretle (kullanıcı sayfayı gördü)
      const timer = setTimeout(() => {
        markAsViewed();
      }, 1000);

      return () => clearTimeout(timer);
    }, [announcements.length])
  );

  // Border animasyonu - Aktif haberler varsa
  useEffect(() => {
    if (announcements.length > 0) {
      const borderAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(borderPulseAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(borderPulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      );
      borderAnimation.start();
    } else {
      borderPulseAnim.setValue(1);
    }
  }, [announcements.length]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {announcements.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.iconContainer}>
              <Newspaper size={64} color="#64748b" />
            </View>
            <Text style={styles.title}>Eğitimden Haberler</Text>
            <Text style={styles.subtitle}>Çok Yakında...</Text>
            <Text style={styles.description}>
              Eğitim haberleri, duyurular ve önemli gelişmeler burada yer alacak.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Eğitim Haberleri</Text>
            {announcements.map((announcement) => (
              <Animated.View
                key={announcement.id}
                style={[
                  styles.announcementCard,
                  {
                    borderColor: borderPulseAnim.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: ['rgba(255, 215, 0, 0.3)', 'rgba(255, 215, 0, 1)'],
                    }),
                  }
                ]}
              >
                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: '/campaign-detail',
                      params: { id: announcement.id }
                    });
                  }}
                >
                  {/* Logo */}
                  <View style={styles.logoContainer}>
                    <Image
                      source={require('../../assets/logo.png')}
                      style={styles.logo}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Görsel */}
                  {announcement.image_url && (
                    <Image
                      source={{ uri: announcement.image_url }}
                      style={styles.announcementImage}
                      resizeMode="cover"
                    />
                  )}

                  {/* İçerik */}
                  <View style={styles.announcementContent}>
                    <Text style={styles.announcementTitle}>{announcement.title}</Text>
                    {announcement.description && (
                      <Text style={styles.announcementDescription} numberOfLines={3}>
                        {announcement.description}
                      </Text>
                    )}
                  </View>

                  {/* Badge */}
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>YENİ</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#334155',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  announcementCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  logoContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 48,
    height: 48,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  announcementImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#334155',
  },
  announcementContent: {
    padding: 16,
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  announcementDescription: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 20,
    marginBottom: 8,
  },
  viewCount: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
