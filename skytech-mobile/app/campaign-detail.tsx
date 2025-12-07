import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react-native';

export default function CampaignDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewCountIncremented, setViewCountIncremented] = useState(false);

  // Kampanya ID'sini al
  const campaignId = params.id as string;

  useEffect(() => {
    if (!campaignId) {
      Alert.alert('Hata', 'Kampanya bulunamadı');
      router.back();
      return;
    }

    const fetchCampaign = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('id', campaignId)
          .single();

        if (error) {
          console.error('Kampanya çekme hatası:', error);
          Alert.alert('Hata', 'Kampanya yüklenemedi');
          router.back();
          return;
        }

        setCampaign(data);
      } catch (error) {
        console.error('Kampanya yükleme hatası:', error);
        Alert.alert('Hata', 'Beklenmedik bir hata oluştu');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId]);

  // Görüntülenme sayısını artır
  useEffect(() => {
    if (!campaignId || viewCountIncremented) return;

    const incrementView = async () => {
      try {
        const { error } = await supabase.rpc('increment_view_count', {
          row_id: campaignId,
        });

        if (error) {
          console.error('Görüntülenme sayısı artırma hatası:', error);
        } else {
          setViewCountIncremented(true);
          // Kampanya verisini güncelle
          if (campaign) {
            setCampaign({ ...campaign, view_count: (campaign.view_count || 0) + 1 });
          }
        }
      } catch (error) {
        console.error('Görüntülenme sayısı artırma hatası:', error);
      }
    };

    incrementView();
  }, [campaignId, viewCountIncremented, campaign]);

  const handleJoin = async () => {
    if (!campaign?.target_link) {
      Alert.alert('Hata', 'Link bulunamadı');
      return;
    }

    try {
      const url = campaign.target_link;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Hata', 'Link açılamıyor');
      }
    } catch (error) {
      console.error('Link açma hatası:', error);
      Alert.alert('Hata', 'Link açılırken bir sorun oluştu');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!campaign) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Kampanya bulunamadı</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* GERİ BUTONU */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* KAMPANYA GÖRSELİ */}
        {campaign.image_url && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: campaign.image_url }}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        )}

        {/* İÇERİK */}
        <View style={styles.content}>
          {/* BAŞLIK */}
          <Text style={styles.title}>{campaign.title}</Text>

          {/* AÇIKLAMA */}
          {campaign.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>{campaign.description}</Text>
            </View>
          )}

          {/* TARİH BİLGİSİ */}
          {(campaign.start_date || campaign.end_date) && (
            <View style={styles.dateContainer}>
              {campaign.start_date && (
                <Text style={styles.dateText}>
                  📅 Başlangıç: {new Date(campaign.start_date).toLocaleDateString('tr-TR')}
                </Text>
              )}
              {campaign.end_date && (
                <Text style={styles.dateText}>
                  📅 Bitiş: {new Date(campaign.end_date).toLocaleDateString('tr-TR')}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* SABİT BUTON */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.joinButton} onPress={handleJoin}>
          <Text style={styles.joinButtonText}>🎯 Fırsata Git</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#1e293b',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    lineHeight: 36,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#e2e8f0',
    lineHeight: 24,
  },
  dateContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  buttonContainer: {
    padding: 20,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  joinButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    padding: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    textAlign: 'center',
  },
  backButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
});

