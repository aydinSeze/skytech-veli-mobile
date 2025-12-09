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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { useStudent } from '../../context/StudentContext';
import { Wallet, Coffee, Trophy, ArrowRight, Utensils } from 'lucide-react-native';
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
  const [readyOrders, setReadyOrders] = useState<any[]>([]); // Hazır siparişler
  const [expandedReadyOrders, setExpandedReadyOrders] = useState(false); // Accordion durumu
  const [activeOrders, setActiveOrders] = useState<any[]>([]); // Aktif siparişler (pending, preparing, ready)
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

  const fetchReadyOrders = async () => {
    if (!student?.id) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('student_id', student.id)
        .eq('status', 'ready')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReadyOrders(data || []);
    } catch (error) {
      console.error('Hazır siparişler çekme hatası:', error);
    }
  };

  // Aktif siparişleri çek (pending, preparing, ready) - OKUL BAZLI İZOLASYON
  const fetchActiveOrders = async () => {
    if (!student?.id || !student?.school_id) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('student_id', student.id)
        .eq('school_id', student.school_id) // OKUL BAZLI İZOLASYON
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Aktif siparişler çekme hatası:', error);
        setActiveOrders([]);
        return;
      }
      
      setActiveOrders(data || []);
    } catch (error) {
      console.error('Aktif siparişler çekme hatası:', error);
      setActiveOrders([]);
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
            filter: 'display_location=eq.ana_sayfa',
          },
          (payload) => {
            fetchActiveAnnouncement();
            
            // Yeni kampanya/haber eklendiğinde bildirim
            if (payload.eventType === 'INSERT' || (payload.eventType === 'UPDATE' && payload.new.is_active)) {
              Alert.alert(
                '🎉 Yeni Etkinlik!',
                'SkyTech\'ten yeni bir etkinlik duyurusu var! Ana sayfadaki kartı kontrol edin.'
              );
            }
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
    fetchReadyOrders();
    fetchActiveOrders();

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
        (payload) => {
          // Yeni işlem geldi, listeyi yenile
          fetchRecentTransactions();
          fetchBalance();
          
          // Bildirim göster
          if (payload.eventType === 'INSERT') {
            const transaction = payload.new;
            if (transaction.transaction_type === 'deposit') {
              // Bakiye yüklendi bildirimi
              Alert.alert(
                '💰 Bakiye Yüklendi',
                `Bakiyenize ₺${Math.abs(transaction.amount).toFixed(2)} yüklendi!`
              );
            } else if (transaction.transaction_type === 'purchase') {
              // Ürün alındı bildirimi
              Alert.alert(
                '🛒 Sipariş Tamamlandı',
                `Siparişiniz teslim edildi. ₺${Math.abs(transaction.amount).toFixed(2)} bakiyenizden düşüldü.`
              );
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `student_id=eq.${student.id}`,
        },
        (payload) => {
          // Sipariş durumu değişti
          const order = payload.new;
          if (order.status === 'preparing') {
            Alert.alert('👨‍🍳 Siparişiniz Hazırlanıyor', 'Siparişiniz hazırlanmaya başlandı!');
            fetchReadyOrders(); // Hazır siparişler listesini güncelle
          } else if (order.status === 'ready') {
            Alert.alert('✅ Siparişiniz Hazır', 'Siparişiniz hazır! Lütfen kantinden alınız.');
            fetchReadyOrders(); // Hazır siparişler listesini güncelle
          } else if (order.status === 'completed') {
            // Sipariş teslim edildi, hazır siparişler listesinden çıkar
            fetchReadyOrders(); // Hazır siparişler listesini güncelle (artık ready değil, completed)
          }
          fetchRecentTransactions();
          fetchActiveOrders(); // Aktif siparişler listesini güncelle
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `student_id=eq.${student.id}`,
        },
        () => {
          // Herhangi bir değişiklikte hazır siparişler ve aktif siparişler listesini güncelle
          fetchReadyOrders();
          fetchActiveOrders();
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        showsVerticalScrollIndicator={false}
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

            {/* Etüt Yemekleri */}
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/etut-menu')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#10b98120' }]}>
                <Utensils size={28} color="#10b981" />
              </View>
              <Text style={styles.quickActionTitle}>Etüt Yemekleri</Text>
            </TouchableOpacity>
          </View>

          {/* SkyTech Ödüllü Etkinliklerimiz - Dinamik Kampanya Kartı */}
          <View style={{ marginTop: 12 }}>
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

          {/* SİPARİŞ TAKİP KARTI - Kampanya Kartının Hemen Altında */}
          <View style={{ marginTop: 12 }}>
            {activeOrders.length > 0 ? (
              activeOrders.map((order) => {
                const isReady = order.status === 'ready';
                const statusText = order.status === 'ready' ? 'Hazır' : 
                                  order.status === 'preparing' ? 'Hazırlanıyor' : 
                                  'Beklemede';
                
                // Ürün adlarını formatla
                let itemsText = 'Sipariş';
                if (order.items_json && Array.isArray(order.items_json)) {
                  itemsText = order.items_json
                    .map((item: any) => {
                      const qty = item.quantity || 0;
                      const name = item.name || 'Ürün';
                      return `${qty}x ${name}`;
                    })
                    .join(', ');
                }

                return (
                  <TouchableOpacity
                    key={order.id}
                    style={[
                      styles.orderTrackingCard,
                      isReady && styles.orderTrackingCardReady
                    ]}
                    onPress={() => router.push('/(tabs)/orders')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.orderTrackingHeader}>
                      <View style={styles.orderTrackingIconContainer}>
                        <Text style={styles.orderTrackingIcon}>
                          {isReady ? '✅' : order.status === 'preparing' ? '👨‍🍳' : '⏳'}
                        </Text>
                      </View>
                      <View style={styles.orderTrackingInfo}>
                        <Text style={styles.orderTrackingTitle}>Sipariş Takibi</Text>
                        <Text style={styles.orderTrackingOrderNumber}>
                          Sipariş #{order.id.slice(0, 8)}
                        </Text>
                      </View>
                      <View style={[
                        styles.orderTrackingStatusBadge,
                        isReady && styles.orderTrackingStatusBadgeReady
                      ]}>
                        <Text style={[
                          styles.orderTrackingStatusText,
                          isReady && styles.orderTrackingStatusTextReady
                        ]}>
                          {statusText}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.orderTrackingDetails}>
                      <Text style={styles.orderTrackingItems} numberOfLines={2}>
                        {itemsText}
                      </Text>
                      <Text style={styles.orderTrackingAmount}>
                        ₺{Number(order.total_amount || 0).toFixed(2)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              // Aktif sipariş yoksa bilgi kartı göster
              <View style={styles.orderTrackingCardEmpty}>
                <View style={styles.orderTrackingHeader}>
                  <View style={styles.orderTrackingIconContainer}>
                    <Text style={styles.orderTrackingIcon}>📦</Text>
                  </View>
                  <View style={styles.orderTrackingInfo}>
                    <Text style={styles.orderTrackingTitle}>Sipariş Takibi</Text>
                    <Text style={styles.orderTrackingOrderNumber}>
                      Aktif siparişiniz bulunmuyor
                    </Text>
                  </View>
                </View>
                <View style={styles.orderTrackingDetails}>
                  <Text style={styles.orderTrackingItemsEmpty}>
                    Henüz bir sipariş vermediniz veya tüm siparişleriniz tamamlandı.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Sipariş Hazır Kartı - Kampanya Kartının Hemen Altında */}
          {readyOrders.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.readyOrderCard}>
                {/* Başlık - Tıklanabilir */}
                <TouchableOpacity
                  style={styles.readyOrderHeader}
                  onPress={() => setExpandedReadyOrders(!expandedReadyOrders)}
                  activeOpacity={0.7}
                >
                  <View style={styles.readyOrderIconContainer}>
                    <Text style={styles.readyOrderIcon}>✅</Text>
                  </View>
                  <View style={styles.readyOrderInfo}>
                    <Text style={styles.readyOrderTitle}>Hazır Olan Siparişler</Text>
                    <Text style={styles.readyOrderSubtitle}>
                      {String(readyOrders.length)} siparişiniz kantinde hazır bekliyor
                    </Text>
                  </View>
                  <Text style={styles.expandIcon}>{expandedReadyOrders ? '▼' : '▶'}</Text>
                </TouchableOpacity>
                
                {/* Detaylar - Accordion */}
                {expandedReadyOrders && (
                  <View style={styles.readyOrderDetails}>
                    {readyOrders.map((order) => {
                      let itemsText = 'Sipariş';
                      if (order.items_json && Array.isArray(order.items_json)) {
                        itemsText = order.items_json
                          .map((item: any) => {
                            const qty = item.quantity || 0;
                            const name = item.name || 'Ürün';
                            return `${qty}x ${name}`;
                          })
                          .join(', ');
                      }
                      return (
                        <TouchableOpacity
                          key={order.id}
                          style={styles.readyOrderItem}
                          onPress={() => router.push('/(tabs)/orders')}
                        >
                          <View style={styles.readyOrderItemContent}>
                            <Text style={styles.readyOrderItemText}>{itemsText}</Text>
                            <Text style={styles.readyOrderItemPrice}>₺{Number(order.total_amount || 0).toFixed(2)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
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
  scrollContent: {
    paddingBottom: 20,
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
    flexWrap: 'wrap',
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
  readyOrderCard: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#34d399',
  },
  readyOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readyOrderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  readyOrderIcon: {
    fontSize: 24,
  },
  readyOrderInfo: {
    flex: 1,
  },
  readyOrderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  readyOrderSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  readyOrderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  readyOrderItemText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
  },
  readyOrderItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  expandIcon: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
  },
  readyOrderDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  readyOrderItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  // Sipariş Takip Kartı Stilleri
  orderTrackingCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 12,
  },
  orderTrackingCardReady: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
    borderWidth: 3,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  orderTrackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderTrackingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderTrackingIcon: {
    fontSize: 24,
  },
  orderTrackingInfo: {
    flex: 1,
  },
  orderTrackingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  orderTrackingOrderNumber: {
    fontSize: 12,
    color: '#94a3b8',
  },
  orderTrackingStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f59e0b20',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  orderTrackingStatusBadgeReady: {
    backgroundColor: '#10b98120',
    borderColor: '#10b981',
  },
  orderTrackingStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  orderTrackingStatusTextReady: {
    color: '#10b981',
  },
  orderTrackingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  orderTrackingItems: {
    fontSize: 14,
    color: '#e2e8f0',
    flex: 1,
    marginRight: 12,
  },
  orderTrackingAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  orderTrackingCardEmpty: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    opacity: 0.7,
  },
  orderTrackingItemsEmpty: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});

