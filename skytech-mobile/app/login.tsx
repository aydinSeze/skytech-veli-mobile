import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Keyboard,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useStudent } from '../context/StudentContext';
import { LogIn } from 'lucide-react-native';

const REMEMBER_ME_KEY = '@skytech:remember_access_code';
const SAVED_ACCESS_CODE_KEY = '@skytech:saved_access_code';

export default function LoginScreen() {
  const [accessCode, setAccessCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { student, setStudent, isLoading } = useStudent();

  // Uygulama açıldığında kaydedilmiş kodu yükle (SADECE INPUT'U DOLDUR, GİRİŞ YAPMA)
  useEffect(() => {
    // Eğer zaten öğrenci varsa, kod yükleme
    if (student) return;

    const loadSavedCode = async () => {
      try {
        const savedCode = await AsyncStorage.getItem(SAVED_ACCESS_CODE_KEY);
        const rememberMeValue = await AsyncStorage.getItem(REMEMBER_ME_KEY);
        
        // Eğer kayıtlı kod varsa, sadece input'u doldur (AUTO-FILL ONLY)
        if (savedCode && rememberMeValue === 'true') {
          setAccessCode(savedCode);
          setRememberMe(true);
          // Otomatik giriş yapma - kullanıcı "Giriş Yap" butonuna kendisi basacak
        }
      } catch (error) {
        console.error('Kaydedilmiş kod yüklenemedi:', error);
      }
    };
    
    loadSavedCode();
  }, [student]);

  const handleLogin = async () => {
    if (!accessCode || accessCode.trim().length === 0) {
      Alert.alert('Hata', 'Lütfen erişim kodunu girin');
      return;
    }

    const cleanCode = accessCode.trim().toUpperCase();

    setLoading(true);
    try {
      // Access code ile öğrenci sorgula
      const { data: studentData, error } = await supabase
        .from('students')
        .select('id, full_name, student_number, wallet_balance, school_id, access_code')
        .eq('access_code', cleanCode)
        .single();

      if (error || !studentData) {
        Alert.alert(
          'Giriş Başarısız',
          'Hatalı erişim kodu. Lütfen kodunuzu kontrol edip tekrar deneyin.'
        );
        return;
      }

      // StudentContext'e kaydet
      setStudent({
        id: studentData.id,
        student_number: studentData.student_number || '',
        full_name: studentData.full_name,
        wallet_balance: studentData.wallet_balance || 0,
        school_id: studentData.school_id,
      });

      // Beni Hatırla seçiliyse kaydet
      if (rememberMe) {
        await AsyncStorage.setItem(SAVED_ACCESS_CODE_KEY, cleanCode);
        await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
      } else {
        // Seçili değilse temizle
        await AsyncStorage.removeItem(SAVED_ACCESS_CODE_KEY);
        await AsyncStorage.removeItem(REMEMBER_ME_KEY);
      }

      // Ana sayfaya yönlendir
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Giriş hatası:', error);
      Alert.alert(
        'Giriş Başarısız',
        error.message || 'Beklenmedik bir hata oluştu. Lütfen tekrar deneyin.'
      );
    } finally {
      setLoading(false);
    }
  };

  const { height } = Dimensions.get('window');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { minHeight: height - (Platform.OS === 'ios' ? 100 : 80) }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={Platform.OS === 'ios'}
          keyboardDismissMode="on-drag"
          style={styles.scrollView}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>SkyTech Campus</Text>
              <Text style={styles.subtitle}>Öğrenci Portalı</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Erişim Kodu</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: A1B2C3"
                  placeholderTextColor="#64748b"
                  value={accessCode}
                  onChangeText={(text) => {
                    const upperText = text.toUpperCase();
                    setAccessCode(upperText);
                    // 6 karakter girildiğinde klavyeyi otomatik kapat
                    if (upperText.length === 6) {
                      Keyboard.dismiss();
                    }
                  }}
                  autoCapitalize="characters"
                  keyboardType="default"
                  maxLength={6}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <Text style={styles.hint}>
                  Okul/kantin panelinden aldığınız 6 haneli erişim kodunu girin
                </Text>
              </View>

              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View style={[styles.checkboxBox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Beni Hatırla</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
  },
  content: {
    justifyContent: 'center',
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  checkboxContainer: {
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#e2e8f0',
  },
});
