import { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useStudent } from '../context/StudentContext';
import { ArrowLeft, Calendar, Utensils, ShoppingCart, Plus, Minus, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';

type EtutMenu = {
    id: string;
    menu_date: string;
    items_json: Array<{ name: string; price: number }>;
    is_active: boolean;
};

type CartItem = {
    menuItem: { name: string; price: number };
    quantity: number;
    menuDate: string;
};

export default function EtutMenuScreen() {
    const { student } = useStudent();
    const [menus, setMenus] = useState<EtutMenu[]>([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartModalOpen, setIsCartModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchEtutMenus();
    }, [student]);

    const fetchEtutMenus = async () => {
        if (!student?.school_id) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('etut_menu')
                .select('*')
                .eq('school_id', student.school_id)
                .eq('is_active', true)
                .order('menu_date', { ascending: true });

            if (error) throw error;
            setMenus(data || []);
        } catch (error: any) {
            console.error('Etüt menüsü çekme hatası:', error);
            Alert.alert('Hata', `Etüt menüsü yüklenirken hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const addToCart = (menuItem: { name: string; price: number }, menuDate: string) => {
        const existingItem = cart.find(item => 
            item.menuItem.name === menuItem.name && item.menuDate === menuDate
        );
        
        if (existingItem) {
            setCart(cart.map(item =>
                item.menuItem.name === menuItem.name && item.menuDate === menuDate
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, { menuItem, quantity: 1, menuDate }]);
        }
        Alert.alert('Başarılı', `${menuItem.name} sepete eklendi!`);
    };

    const removeFromCart = (menuItemName: string, menuDate: string) => {
        setCart(cart.filter(item => 
            !(item.menuItem.name === menuItemName && item.menuDate === menuDate)
        ));
    };

    const updateCartQuantity = (menuItemName: string, menuDate: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(menuItemName, menuDate);
        } else {
            setCart(cart.map(item =>
                item.menuItem.name === menuItemName && item.menuDate === menuDate
                    ? { ...item, quantity }
                    : item
            ));
        }
    };

    const getTotalPrice = () => {
        return cart.reduce((total, item) => {
            return total + (item.menuItem.price * item.quantity);
        }, 0);
    };

    const handlePlaceOrder = async () => {
        if (!student || cart.length === 0) {
            Alert.alert('Hata', 'Sepetiniz boş!');
            return;
        }

        if (!student.id || !student.school_id) {
            Alert.alert('Hata', 'Öğrenci bilgisi eksik!');
            return;
        }

        setIsSubmitting(true);
        try {
            const items = cart.map(item => ({
                name: item.menuItem.name,
                quantity: item.quantity,
                price: item.menuItem.price,
                menu_date: item.menuDate
            }));

            const totalAmount = getTotalPrice();

            // Önce öğrencinin bakiyesini kontrol et
            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('wallet_balance')
                .eq('id', student.id)
                .single();

            if (studentError) throw studentError;

            if ((studentData?.wallet_balance || 0) < totalAmount) {
                Alert.alert('Yetersiz Bakiye', `Bakiyeniz yetersiz. Mevcut bakiye: ₺${(studentData?.wallet_balance || 0).toFixed(2)}`);
                setIsSubmitting(false);
                return;
            }

            // Etüt yemekleri siparişi oluştur (BAKİYE DÜŞÜRME YOK - Sadece teslim edildiğinde)
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    student_id: student.id,
                    school_id: student.school_id,
                    order_type: 'etut', // Etüt yemekleri siparişi
                    status: 'pending',
                    items_json: items,
                    total_amount: totalAmount,
                    payment_status: 'pending' // Ödeme durumu: pending = bakiye düşmedi
                })
                .select()
                .single();

            if (orderError) throw orderError;

            Alert.alert('Başarılı', 'Etüt yemekleri siparişiniz oluşturuldu!', [
                {
                    text: 'Tamam',
                    onPress: () => {
                        setCart([]);
                        setIsCartModalOpen(false);
                    }
                }
            ]);
        } catch (error: any) {
            console.error('Sipariş oluşturma hatası:', error);
            Alert.alert('Hata', `Sipariş oluşturulurken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderMenuCard = ({ item }: { item: EtutMenu }) => (
        <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
                <View style={styles.dateContainer}>
                    <Calendar size={20} color="#10b981" />
                    <Text style={styles.menuDate}>{formatDate(item.menu_date)}</Text>
                </View>
            </View>
            <View style={styles.menuItems}>
                {item.items_json && Array.isArray(item.items_json) && item.items_json.map((menuItem, idx) => {
                    const cartItem = cart.find(ci => 
                        ci.menuItem.name === menuItem.name && ci.menuDate === item.menu_date
                    );
                    
                    return (
                        <View key={idx} style={styles.menuItem}>
                            <View style={styles.menuItemInfo}>
                                <Utensils size={16} color="#94a3b8" />
                                <Text style={styles.menuItemName}>{menuItem.name}</Text>
                            </View>
                            <View style={styles.menuItemActions}>
                                <Text style={styles.menuItemPrice}>₺{menuItem.price.toFixed(2)}</Text>
                                {cartItem ? (
                                    <View style={styles.quantityControls}>
                                        <TouchableOpacity
                                            onPress={() => updateCartQuantity(menuItem.name, item.menu_date, cartItem.quantity - 1)}
                                            style={styles.quantityButton}
                                        >
                                            <Minus size={14} color="#ffffff" />
                                        </TouchableOpacity>
                                        <Text style={styles.quantityText}>{cartItem.quantity}</Text>
                                        <TouchableOpacity
                                            onPress={() => updateCartQuantity(menuItem.name, item.menu_date, cartItem.quantity + 1)}
                                            style={styles.quantityButton}
                                        >
                                            <Plus size={14} color="#ffffff" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        onPress={() => addToCart(menuItem, item.menu_date)}
                                        style={styles.addButton}
                                    >
                                        <Plus size={14} color="#ffffff" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Etüt Yemekleri</Text>
                <TouchableOpacity
                    onPress={() => setIsCartModalOpen(true)}
                    style={styles.cartButton}
                >
                    <ShoppingCart size={24} color="#ffffff" />
                    {cart.length > 0 && (
                        <View style={styles.cartBadge}>
                            <Text style={styles.cartBadgeText}>{cart.length}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#10b981" />
                </View>
            ) : (
                <FlatList
                    data={menus}
                    renderItem={renderMenuCard}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Calendar size={64} color="#334155" />
                            <Text style={styles.emptyStateText}>
                                Henüz etüt menüsü yok
                            </Text>
                            <Text style={styles.emptyStateSubtext}>
                                Etüt günleri için yemek menüsü eklendiğinde burada görünecek.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* SEPET MODALI */}
            <Modal
                visible={isCartModalOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsCartModalOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Etüt Yemekleri Sepetim</Text>
                            <TouchableOpacity
                                onPress={() => setIsCartModalOpen(false)}
                                style={styles.closeButton}
                            >
                                <X size={24} color="#ffffff" />
                            </TouchableOpacity>
                        </View>

                        {cart.length === 0 ? (
                            <View style={styles.emptyCart}>
                                <ShoppingCart size={64} color="#334155" />
                                <Text style={styles.emptyCartText}>Sepetiniz boş</Text>
                            </View>
                        ) : (
                            <>
                                <FlatList
                                    data={cart}
                                    keyExtractor={(item, idx) => `${item.menuItem.name}-${item.menuDate}-${idx}`}
                                    renderItem={({ item }) => (
                                        <View style={styles.cartItem}>
                                            <View style={styles.cartItemInfo}>
                                                <Text style={styles.cartItemName}>{item.menuItem.name}</Text>
                                                <Text style={styles.cartItemDate}>{formatDate(item.menuDate)}</Text>
                                                <Text style={styles.cartItemPrice}>
                                                    ₺{item.menuItem.price.toFixed(2)} x {item.quantity}
                                                </Text>
                                            </View>
                                            <View style={styles.cartItemActions}>
                                                <TouchableOpacity
                                                    onPress={() => updateCartQuantity(item.menuItem.name, item.menuDate, item.quantity - 1)}
                                                    style={styles.cartQuantityButton}
                                                >
                                                    <Minus size={16} color="#ffffff" />
                                                </TouchableOpacity>
                                                <Text style={styles.cartQuantityText}>{item.quantity}</Text>
                                                <TouchableOpacity
                                                    onPress={() => updateCartQuantity(item.menuItem.name, item.menuDate, item.quantity + 1)}
                                                    style={styles.cartQuantityButton}
                                                >
                                                    <Plus size={16} color="#ffffff" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => removeFromCart(item.menuItem.name, item.menuDate)}
                                                    style={styles.removeButton}
                                                >
                                                    <X size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                    style={styles.cartList}
                                />
                                <View style={styles.cartFooter}>
                                    <View style={styles.totalContainer}>
                                        <Text style={styles.totalLabel}>Toplam:</Text>
                                        <Text style={styles.totalPrice}>₺{getTotalPrice().toFixed(2)}</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={handlePlaceOrder}
                                        disabled={isSubmitting}
                                        style={[styles.orderButton, isSubmitting && styles.orderButtonDisabled]}
                                    >
                                        <Text style={styles.orderButtonText}>
                                            {isSubmitting ? 'Gönderiliyor...' : 'Sipariş Ver'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
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
    listContent: {
        padding: 16,
        gap: 16,
    },
    menuCard: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#334155',
    },
    menuHeader: {
        marginBottom: 16,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    menuDate: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
        textTransform: 'capitalize',
    },
    menuItems: {
        gap: 12,
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#0f172a',
        borderRadius: 8,
    },
    menuItemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    menuItemName: {
        fontSize: 16,
        color: '#e2e8f0',
        fontWeight: '500',
    },
    menuItemPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#10b981',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
    },
    emptyStateText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateSubtext: {
        color: '#64748b',
        fontSize: 14,
        textAlign: 'center',
    },
    cartButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#1e293b',
        position: 'relative',
    },
    cartBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cartBadgeText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    menuItemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addButton: {
        backgroundColor: '#10b981',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#10b981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 14,
    },
    quantityButton: {
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
        minWidth: 20,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1e293b',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 32,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    closeButton: {
        padding: 4,
    },
    emptyCart: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
    },
    emptyCartText: {
        color: '#64748b',
        marginTop: 16,
        fontSize: 16,
    },
    cartList: {
        maxHeight: 400,
    },
    cartItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    cartItemInfo: {
        flex: 1,
    },
    cartItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 4,
    },
    cartItemDate: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 4,
    },
    cartItemPrice: {
        fontSize: 14,
        color: '#94a3b8',
    },
    cartItemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cartQuantityButton: {
        backgroundColor: '#10b981',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cartQuantityText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        minWidth: 30,
        textAlign: 'center',
    },
    removeButton: {
        padding: 8,
    },
    cartFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    totalContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
    totalPrice: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#10b981',
    },
    orderButton: {
        backgroundColor: '#10b981',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    orderButtonDisabled: {
        opacity: 0.5,
    },
    orderButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

