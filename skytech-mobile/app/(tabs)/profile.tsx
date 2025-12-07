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
import { useRouter } from 'expo-router';
import { useStudent } from '../../context/StudentContext';
import {
  User,
  LogOut,
  Shield,
  FileText,
  ExternalLink,
  Lock,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { student, logout } = useStudent();
  const router = useRouter();
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [userAgreementModalVisible, setUserAgreementModalVisible] = useState(false);
  const [externalLinksModalVisible, setExternalLinksModalVisible] = useState(false);
  const [kvkkModalVisible, setKvkkModalVisible] = useState(false);


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
    { id: 1, title: 'Kullanıcı Sözleşmesi', icon: FileText, onPress: () => setUserAgreementModalVisible(true) },
    { id: 2, title: 'Dış Bağlantılar ve Reklam Politikası', icon: ExternalLink, onPress: () => setExternalLinksModalVisible(true) },
    { id: 3, title: 'Gizlilik ve KVKK', icon: Lock, onPress: () => setKvkkModalVisible(true) },
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

      {/* Kullanıcı Sözleşmesi Modal */}
      <Modal
        visible={userAgreementModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setUserAgreementModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kullanıcı Sözleşmesi</Text>
              <TouchableOpacity
                onPress={() => setUserAgreementModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              <Text style={styles.modalSectionTitle}>1. HİZMETİN TANIMI</Text>
              <Text style={styles.modalText}>
                SkyTech Campus; öğrenci, veli ve kantin işletmesi arasında bakiye ve harcama takibi sağlayan bir yönetim aracıdır.
              </Text>

              <Text style={styles.modalSectionTitle}>2. REKLAM VE YÖNLENDİRME</Text>
              <Text style={styles.modalText}>
                Uygulama içerisinde yer alan 'Haberler', 'Etkinlikler' ve 'Kampanyalar' alanları; bilgilendirme, tanıtım ve reklam amaçlıdır. Bu alanlarda yer alan linkler, kullanıcıyı SkyTech uygulamasından bağımsız, üçüncü taraf web sitelerine yönlendirebilir.
              </Text>

              <Text style={styles.modalSectionTitle}>3. SORUMLULUK REDDİ</Text>
              <Text style={styles.modalText}>
                Yönlendirilen web sitelerinde gerçekleşecek alışverişler, yarışma katılımları veya hizmet alımları tamamen kullanıcının inisiyatifindedir. SkyTech uygulaması, uygulama dışı gerçekleşen hiçbir işlemden sorumlu tutulamaz.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Dış Bağlantılar ve Reklam Politikası Modal */}
      <Modal
        visible={externalLinksModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExternalLinksModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dış Bağlantılar ve Reklam Politikası</Text>
              <TouchableOpacity
                onPress={() => setExternalLinksModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              <Text style={styles.modalSectionTitle}>1. BAĞIMSIZLIK İLKESİ</Text>
              <Text style={styles.modalText}>
                Bu uygulamada tanıtımı yapılan deney setleri, bilgi yarışmaları veya etkinlikler; harici platformlarda gerçekleşmektedir. Uygulama sadece 'Duyuru Panosu' işlevi görür.
              </Text>

              <Text style={styles.modalSectionTitle}>2. İÇERİK</Text>
              <Text style={styles.modalText}>
                Tanıtılan ürün veya hizmetlerin içeriği, fiyatı ve niteliği ilgili web sitesinin sorumluluğundadır.
              </Text>

              <Text style={styles.modalSectionTitle}>3. VELİ ONAYI</Text>
              <Text style={styles.modalText}>
                18 yaşından küçük kullanıcıların, uygulama dışı linklere tıklayarak yapacakları işlemleri veli gözetiminde gerçekleştirmesi esastır.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Gizlilik ve KVKK Modal */}
      <Modal
        visible={kvkkModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setKvkkModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gizlilik ve KVKK</Text>
              <TouchableOpacity
                onPress={() => setKvkkModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              <Text style={styles.modalSectionTitle}>1. VERİ İŞLEME</Text>
              <Text style={styles.modalText}>
                Ad, Soyad ve Okul Numaranız sadece kantin hizmetlerinin yürütülmesi (bakiye takibi) amacıyla işlenir.
              </Text>

              <Text style={styles.modalSectionTitle}>2. REKLAM HEDEFLEME</Text>
              <Text style={styles.modalText}>
                Uygulama içindeki duyurular genel niteliktedir. Kişisel verileriniz (telefon no, ev adresi vb.) reklam veren üçüncü taraflarla ASLA paylaşılmaz.
              </Text>

              <Text style={styles.modalSectionTitle}>3. HESAP SİLME</Text>
              <Text style={styles.modalText}>
                Hesabınızın silinmesini kantinciden talep edebilirsiniz.
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
    overflow: 'hidden', // İçerik kartın dışına taşmasın
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingRight: 16, // Çarpı butonu için sağdan biraz boşluk
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1, // Başlık genişlesin, çarpı butonu sağda kalsın
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.1)', // Hafif arka plan
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginTop: 8,
    marginBottom: 8,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
});

