import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { useStudent } from '../../context/StudentContext';
import { Wallet, Coffee, Trophy, ArrowRight } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import React from 'react';

const EVENT_NOTIFICATIONS_KEY = '@skytech:event_notifications';

const { width } = Dimensions.get('window');

interface Transaction {
  id: string;
  created_at: string;
  amount: number;
  transaction_type: string;
  items_json: any;
}

export default function HomeScreen() {
  const { student } = useStudent();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [promoPulseAnim] = useState(new Animated.Value(1));
  const [borderPulseAnim] = useState(new Animated.Value(1)); // Border yanıp sönme animasyonu (opacity için)
  const [borderWidthAnim] = useState(new Animated.Value(3)); // Border kalınlığı animasyonu
  const [eventNotificationCount, setEventNotificationCount] = useState<number>(0);
  const [activeAnnouncement, setActiveAnnouncement] = useState<any>(null);
  const router = useRouter();

  const fetchBalance = async () => {
    if (!student?.id) return;

    try {
      const { data, error } = await supabase
        .from('students')
        .select('wallet_balance')
        .eq('id', student.id)
        .single();

      if (error) throw error;
      const newBalance = data?.wallet_balance || 0;
      setBalance(newBalance);

      // Bakiye düşükse animasyon başlat
      if (newBalance < 50 && newBalance >= 0) {
        startPulseAnimation();
      } else {
        stopPulseAnimation();
      }
    } catch (error) {
      console.error('Bakiye çekme hatası:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRecentTransactions = async () => {
    if (!student?.id) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentTransactions(data || []);
    } catch (error) {
      console.error('İşlem geçmişi çekme hatası:', error);
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.setValue(1);
    pulseAnim.stopAnimation();
  };

  // Kampanya kartı border animasyonu - Aktif kampanya varsa sürekli yanıp sönsün
  useEffect(() => {
    if (activeAnnouncement) {
      // Border kalınlığı animasyonu (3 -> 6 -> 3) - Daha belirgin yanıp sönme
      const borderWidthAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(borderWidthAnim, {
            toValue: 6,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(borderWidthAnim, {
            toValue: 3,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      );

      // Border opacity animasyonu (1 -> 0.4 -> 1) - Daha belirgin yanıp sönme
      const borderOpacityAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(borderPulseAnim, {
            toValue: 0.4,
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

      borderWidthAnimation.start();
      borderOpacityAnimation.start();

      return () => {
        borderWidthAnimation.stop();
        borderOpacityAnimation.stop();
        borderWidthAnim.setValue(3);
        borderPulseAnim.setValue(1);
      };
    } else {
      borderWidthAnim.setValue(1);
      borderPulseAnim.setValue(1);
    }
  }, [activeAnnouncement]);

  // Etkinlik bildirimlerini yükle
  useEffect(() => {
    const loadEventNotifications = async () => {
      try {
        const count = await AsyncStorage.getItem(EVENT_NOTIFICATIONS_KEY);
        setEventNotificationCount(count ? parseInt(count, 10) : 0);
      } catch (error) {
        console.error('Etkinlik bildirimi yüklenemedi:', error);
      }
    };
    loadEventNotifications();
  }, []);

  // Aktif kampanyayı çek (TARİH ARALIĞI KONTROLLÜ) - useFocusEffect ile her sayfa açıldığında yenile
  const fetchActiveAnnouncement = React.useCallback(async () => {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .eq('display_location', 'ana_sayfa') // SADECE KAMPANYALAR - Haberler değil!
        .lte('start_date', now) // Başlangıç tarihi geçmiş veya bugün
        .gte('end_date', now)   // Bitiş tarihi gelecek veya bugün
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Kampanya çekme hatası:', error);
        setActiveAnnouncement(null);
        return;
      }

      setActiveAnnouncement(data || null);
    } catch (error) {
      console.error('Kampanya yükleme hatası:', error);
      setActiveAnnouncement(null);
    }
  }, []);

  // Her sayfa odaklandığında kampanyayı yeniden çek
  useFocusEffect(
    React.useCallback(() => {
      fetchActiveAnnouncement();

      // Real-time subscription for announcements
      const announcementChannel = supabase
        .channel('announcements-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'announcements',
          },
          () => {
            fetchActiveAnnouncement();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(announcementChannel);
      };
    }, [fetchActiveAnnouncement])
  );

  // Uygulama kullanım istatistiği kaydet
  useEffect(() => {
    if (!student?.id) return;

    const logAppUsage = async () => {
      try {
        await supabase.from('app_usage').insert({
          student_id: student.id,
          action: 'app_open',
          feature_name: 'home',
          device_info: {
            platform: 'mobile',
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Kullanım istatistiği kaydedilemedi:', error);
      }
    };

    logAppUsage();
    fetchBalance();
    fetchRecentTransactions();

    // CANLI BAKİYE GÜNCELLEMESİ - Real-time subscription
    const balanceChannel = supabase
      .channel('balance-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'students',
          filter: `id=eq.${student.id}`,
        },
        (payload) => {
          const newBalance = payload.new.wallet_balance || 0;
          setBalance(newBalance);
          
          // Bakiye düşükse animasyon
          if (newBalance < 50 && newBalance >= 0) {
            startPulseAnimation();
          } else {
            stopPulseAnimation();
          }
        }
      )
      .subscribe();

    // CANLI SİPARİŞ GÜNCELLEMESİ - Real-time subscription
    const ordersChannel = supabase
      .channel('orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `student_id=eq.${student.id}`,
        },
        () => {
          // Yeni işlem geldi, listeyi yenile
          fetchRecentTransactions();
          fetchBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(balanceChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [student?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBalance();
    fetchRecentTransactions();
  };

  const formatTransactionItems = (itemsJson: any) => {
    if (!itemsJson) return 'İşlem detayı yok';
    
    if (Array.isArray(itemsJson)) {
      return itemsJson.map((item: any) => {
        const quantity = item.quantity || 1;
        const name = item.name || 'Ürün';
        return `${quantity}x ${name}`;
      }).join(', ');
    }
    
    if (itemsJson.note) {
      return itemsJson.note;
    }
    
    return 'İşlem detayı yok';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBalanceColor = () => {
    if (balance < 0) return '#ef4444'; // Kırmızı (negatif)
    if (balance < 50) return '#f59e0b'; // Sarı (düşük)
    return '#10b981'; // Yeşil (yeterli)
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hoş Geldin{student?.full_name ? `, ${student.full_name.split(' ')[0]}` : ''}!</Text>
          <Text style={styles.subGreeting}>Mevcut bakiyeniz</Text>
        </View>

        {/* Balance Card - Animasyonlu */}
        <Animated.View style={[styles.balanceCard, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.balanceHeader}>
            <Wallet size={24} color="#94a3b8" />
            <Text style={styles.balanceLabel}>Mevcut Bakiye</Text>
          </View>
          <Text style={[styles.balanceAmount, { color: getBalanceColor() }]}>
            ₺{loading ? '...' : balance.toFixed(2)}
          </Text>
          {balance < 50 && balance >= 0 && (
            <Text style={styles.lowBalanceWarning}>
              ⚠️ Bakiye düşük! Lütfen para yükleyin.
            </Text>
          )}
        </Animated.View>

        {/* Kartlar */}
        <View style={styles.section}>
          <View style={styles.quickActionsGrid}>
            {/* Kantin Menüsü */}
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/menu')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#f59e0b20' }]}>
                <Coffee size={28} color="#f59e0b" />
              </View>
              <Text style={styles.quickActionTitle}>Kantin Menüsü</Text>
            </TouchableOpacity>

            {/* SkyTech Ödüllü Etkinliklerimiz - Dinamik Kampanya Kartı */}
            <Animated.View 
              style={[
                styles.promoCardWrapper,
                activeAnnouncement && {
                  transform: [{ scale: promoPulseAnim }]
                }
              ]}
            >
              <Animated.View
                style={[
                  activeAnnouncement ? {
                    borderWidth: borderWidthAnim,
                    borderColor: borderPulseAnim.interpolate({
                      inputRange: [0.4, 1],
                      outputRange: ['rgba(255, 215, 0, 0.4)', 'rgba(255, 215, 0, 1)'], // Sarı border opacity animasyonu
                    }),
                    borderRadius: 12,
                  } : {}
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.quickActionCard,
                    activeAnnouncement ? {
                      ...styles.promoCardActive,
                      borderWidth: 0, // İç kartta border yok, dış Animated.View'de var
                    } : styles.promoCardInactive
                  ]}
                  onPress={() => {
                  if (activeAnnouncement) {
                    // Detay sayfasına git (kampanya ID ile)
                    router.push({
                      pathname: '/campaign-detail',
                      params: { id: activeAnnouncement.id }
                    });
                  } else {
                    // Aktif kampanya yoksa tepkisiz kal
                    console.log('Aktif kampanya yok');
                  }
                }}
                disabled={!activeAnnouncement}
              >
                {activeAnnouncement ? (
                  <>
                    {/* Aktif Kampanya - Sarı Arka Plan, Animasyonlu, Rozetli */}
                    <View style={styles.promoCardContent}>
                      {/* Kırmızı Rozet */}
                      <View style={styles.promoBadge}>
                        <Text style={styles.promoBadgeText}>1</Text>
                      </View>
                      
                      {/* Logo - ÜSTTE BÜYÜK */}
                      <View style={styles.promoLogoContainer}>
                        <Image
                          source={require('../../assets/logo.png')}
                          style={styles.promoLogo}
                          resizeMode="contain"
                        />
                      </View>
                      
                      {/* İçerik */}
                      <View style={styles.promoTextContainer}>
                        <Text style={styles.promoTitle} numberOfLines={2}>
                          {activeAnnouncement.title}
                        </Text>
                        {activeAnnouncement.description && (
                          <Text style={styles.promoDescription} numberOfLines={2}>
                            {activeAnnouncement.description}
                          </Text>
                        )}
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Aktif Kampanya Yok - Gri, Sönük */}
                    <View style={styles.promoCardContentInactive}>
                      <View style={[styles.iconContainer, { backgroundColor: '#64748b20' }]}>
                        <Image
                          source={require('../../assets/logo.png')}
                          style={styles.promoLogoInactive}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={[styles.quickActionTitle, { color: '#64748b' }]}>
                        SkyTech Ödüllü Etkinliklerimiz
                      </Text>
                      <Text style={[styles.promoText, { color: '#64748b' }]}>
                        Çok Yakında!
                      </Text>
                    </View>
                  </>
                )}
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>
        </View>

        {/* Son İşlemler */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son İşlemler</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
              <Text style={styles.seeAllText}>Tümünü Gör</Text>
            </TouchableOpacity>
          </View>
          
          {recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Henüz işlem yok</Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {recentTransactions.slice(0, 3).map((transaction) => (
                <View key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDate}>
                      {formatDate(transaction.created_at)}
                    </Text>
                    <Text style={styles.transactionItems}>
                      {formatTransactionItems(transaction.items_json)}
                    </Text>
                  </View>
                  <Text style={[
                    styles.transactionAmount,
                    { color: transaction.transaction_type === 'deposit' ? '#10b981' : '#ef4444' }
                  ]}>
                    {transaction.transaction_type === 'deposit' ? '+' : '-'}₺{transaction.amount.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
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
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 16,
    color: '#94a3b8',
  },
  balanceCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginLeft: 8,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  lowBalanceWarning: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center', // İçeriği dikey olarak ortala
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  emptyState: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
  },
  promoCardWrapper: {
    flex: 1,
  },
  promoCard: {
    backgroundColor: '#fbbf2420',
    borderColor: '#fbbf24',
    borderWidth: 2,
  },
  promoCardActive: {
    backgroundColor: '#1e293b', // Dark mode rengi
    borderColor: '#FFD700', // Sarı border
    borderWidth: 3,
    minHeight: 140,
    position: 'relative',
  },
  promoCardInactive: {
    backgroundColor: '#64748b20',
    borderColor: '#64748b',
    borderWidth: 1,
    opacity: 0.6,
  },
  promoCardContent: {
    width: '100%',
    height: '100%',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  promoCardContentInactive: {
    width: '100%',
    height: '100%',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoLogoContainer: {
    width: 80,
    height: 80,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 40,
    padding: 8,
  },
  promoLogo: {
    width: '100%',
    height: '100%',
  },
  promoLogoInactive: {
    width: 40,
    height: 40,
    opacity: 0.5,
  },
  promoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 10,
  },
  promoBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  promoTextContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff', // Dark mode için beyaz
    textAlign: 'center',
    marginBottom: 4,
  },
  promoDescription: {
    fontSize: 12,
    color: '#e2e8f0', // Dark mode için açık gri
    textAlign: 'center',
    lineHeight: 16,
  },
  promoActionHint: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
  },
  promoActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
  },
  promoText: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '600',
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1e293b',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  transactionsList: {
    gap: 12,
  },
  transactionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  transactionItems: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

