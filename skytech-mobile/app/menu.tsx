import { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    TextInput,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useStudent } from '../context/StudentContext';
import { ArrowLeft, Search, Coffee, Utensils } from 'lucide-react-native';
import { useRouter } from 'expo-router';

type Product = {
    id: string;
    name: string;
    sell_price?: number;
    selling_price?: number; // Web panelinde bu kolon adı kullanılıyor
    description?: string;
    image_url?: string;
    category?: string;
    school_id?: string;
};

export default function MenuScreen() {
    const { student } = useStudent();
    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();

    useEffect(() => {
        fetchMenu();
    }, [student]);

    const fetchMenu = async () => {
        if (!student) {
            console.log('Öğrenci verisi yok');
            setLoading(false);
            return;
        }

        if (!student.school_id) {
            console.log('Öğrencinin okul ID si yok:', student);
            Alert.alert('Hata', 'Öğrenciye ait okul bilgisi bulunamadı.');
            setLoading(false);
            return;
        }

        try {
            console.log('Menü aranıyor... Okul ID:', student.school_id);

            // DİREKT OKUL ID İLE ÜRÜNLERİ ÇEK (GÜVENLİK: SADECE KENDİ OKULUNUN ÜRÜNLERİ)
            // Products tablosunda school_id kolonu var, direkt filtreleme yapıyoruz
            const { data: productsData, error: prodError } = await supabase
                .from('products')
                .select('*')
                .eq('school_id', student.school_id) // SADECE ÖĞRENCİNİN OKULUNA AİT ÜRÜNLER
                .order('name');

            if (prodError) {
                console.error('Ürün çekme hatası (DETAYLI):', {
                    error: prodError,
                    message: prodError.message,
                    details: prodError.details,
                    hint: prodError.hint,
                    code: prodError.code,
                    schoolId: student.school_id
                });
                Alert.alert('Hata', `Ürünler yüklenirken hata oluştu: ${prodError.message || 'Bilinmeyen hata'}`);
                setProducts([]);
                setFilteredProducts([]);
            } else {
                console.log('✅ Bulunan ürün sayısı:', productsData?.length || 0);
                console.log('✅ Ürünler (ilk 3):', productsData?.slice(0, 3).map(p => ({ name: p.name, price: p.sell_price || p.selling_price, school_id: p.school_id })));
                setProducts(productsData || []);
                setFilteredProducts(productsData || []);
                
                if (!productsData || productsData.length === 0) {
                    console.warn('⚠️ Bu okulda henüz ürün yok. Okul ID:', student.school_id);
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (text.trim() === '') {
            setFilteredProducts(products);
        } else {
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(text.toLowerCase())
            );
            setFilteredProducts(filtered);
        }
    };

    const renderProductItem = ({ item }: { item: Product }) => (
        <View style={styles.productCard}>
            <View style={styles.productIcon}>
                <Utensils size={24} color="#3b82f6" />
            </View>
            <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                {item.description && (
                    <Text style={styles.productDesc} numberOfLines={1}>{item.description}</Text>
                )}
            </View>
            <Text style={styles.productPrice}>₺{(item.sell_price || item.selling_price || 0).toFixed(2)}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Kantin Menüsü</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Search size={20} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Ürün ara..."
                        placeholderTextColor="#64748b"
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                </View>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : (
                <FlatList
                    data={filteredProducts}
                    renderItem={renderProductItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Coffee size={48} color="#334155" />
                            <Text style={styles.emptyStateText}>
                                {products.length === 0
                                    ? 'Bu okulda henüz ürün yok.'
                                    : 'Aradığınız ürün bulunamadı.'}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#1e293b',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        padding: 16,
        paddingBottom: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: '#334155',
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: '#ffffff',
        fontSize: 16,
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    productCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#334155',
    },
    productIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 2,
    },
    productDesc: {
        fontSize: 12,
        color: '#94a3b8',
    },
    productPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#3b82f6',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
    },
    emptyStateText: {
        color: '#64748b',
        marginTop: 16,
        fontSize: 16,
    },
});
