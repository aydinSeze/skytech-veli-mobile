import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useStudent } from '../../context/StudentContext';
import {
  User,
  LogOut,
  Bell,
  Shield,
  X,
  Trophy,
} from 'lucide-react-native';

const EVENT_NOTIFICATIONS_KEY = '@skytech:event_notifications';

export default function ProfileScreen() {
  const { student, logout } = useStudent();
  const router = useRouter();
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [eventNotificationCount, setEventNotificationCount] = useState<number>(0);

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
    
    // Her 2 saniyede bir kontrol et (gerçek zamanlı güncelleme için)
    const interval = setInterval(loadEventNotifications, 2000);
    return () => clearInterval(interval);
  }, []);

  // Sayfa odaklandığında etkinlik bildirimi varsa modalı aç (sadece bir kez)
  const [hasCheckedNotifications, setHasCheckedNotifications] = useState(false);
  
  useFocusEffect(
    React.useCallback(() => {
      if (hasCheckedNotifications) return;
      
      const checkAndOpenNotifications = async () => {
        try {
          const count = await AsyncStorage.getItem(EVENT_NOTIFICATIONS_KEY);
          const notificationCount = count ? parseInt(count, 10) : 0;
          if (notificationCount > 0) {
            // Kısa bir gecikme ile modalı aç (sayfa yüklenmesi için)
            setTimeout(() => {
              setNotificationsModalVisible(true);
              setHasCheckedNotifications(true);
            }, 500);
          } else {
            setHasCheckedNotifications(true);
          }
        } catch (error) {
          console.error('Etkinlik bildirimi kontrol edilemedi:', error);
          setHasCheckedNotifications(true);
        }
      };
      checkAndOpenNotifications();
    }, [hasCheckedNotifications])
  );

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const menuItems = [
    { 
      id: 2, 
      title: 'Bildirimler', 
      icon: Bell, 
      onPress: () => setNotificationsModalVisible(true),
      badge: eventNotificationCount > 0 ? eventNotificationCount : undefined
    },
    { id: 3, title: 'Gizlilik ve Güvenlik', icon: Shield, onPress: () => setPrivacyModalVisible(true) },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <User size={32} color="#3b82f6" />
          </View>
          <Text style={styles.userName}>
            {student?.full_name || 'Öğrenci'}
          </Text>
          <Text style={styles.userEmail}>
            {student?.student_number ? `Öğrenci No: ${student.student_number}` : ''}
          </Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={item.onPress}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.iconWrapper}>
                    <Icon size={20} color="#3b82f6" />
                    {item.badge && item.badge > 0 && (
                      <View style={styles.menuBadge}>
                        <Text style={styles.menuBadgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.menuItemText}>{item.title}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        {/* App Version */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>SkyTech Campus Mobil v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Bildirimler Modal */}
      <Modal
        visible={notificationsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setNotificationsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bildirimler</Text>
              <TouchableOpacity
                onPress={() => setNotificationsModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {eventNotificationCount > 0 ? (
                <View style={styles.eventCard}>
                  <View style={styles.eventIconContainer}>
                    <Trophy size={32} color="#fbbf24" />
                  </View>
                  <Text style={styles.eventTitle}>SkyTech Ödüllü Etkinliklerimiz</Text>
                  <Text style={styles.eventText}>
                    {eventNotificationCount} yeni etkinlik duyurusu bulunmaktadır!
                  </Text>
                  <Text style={styles.eventText}>
                    Detaylar için ana sayfadaki "SkyTech Ödüllü Etkinliklerimiz" kartına tıklayın.
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyNotifications}>
                  <Bell size={48} color="#334155" />
                  <Text style={styles.emptyNotificationsText}>
                    Henüz bildiriminiz yok
                  </Text>
                  <Text style={styles.emptyNotificationsSubtext}>
                    Yeni etkinlik duyuruları burada görünecek
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Gizlilik ve Güvenlik Modal */}
      <Modal
        visible={privacyModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gizlilik ve Güvenlik</Text>
              <TouchableOpacity
                onPress={() => setPrivacyModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalText}>
                SkyTech Campus, kişisel verilerinizin güvenliğini ciddiye alır.
              </Text>
              <Text style={styles.modalText}>
                • Tüm verileriniz şifrelenmiş olarak saklanır{'\n'}
                • Erişim kodunuz sadece sizin tarafınızdan kullanılabilir{'\n'}
                • Verileriniz yalnızca okul yönetimi tarafından görüntülenebilir{'\n'}
                • Üçüncü taraflarla veri paylaşımı yapılmaz
              </Text>
              <Text style={styles.modalText}>
                Daha fazla bilgi için okul yönetimi ile iletişime geçebilirsiniz.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#334155',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#94a3b8',
  },
  menuSection: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  menuBadge: {
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
  menuBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  menuItemText: {
    fontSize: 16,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  chevron: {
    fontSize: 24,
    color: '#64748b',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 24,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 22,
    marginBottom: 16,
  },
  eventCard: {
    backgroundColor: '#fbbf2420',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#fbbf24',
    alignItems: 'center',
    marginBottom: 16,
  },
  eventIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fbbf2420',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 12,
    textAlign: 'center',
  },
  eventText: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyNotifications: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyNotificationsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 16,
  },
  emptyNotificationsSubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
});

