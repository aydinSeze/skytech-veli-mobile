import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useStudent } from '../../context/StudentContext';
import { ShoppingBag, Clock, CheckCircle } from 'lucide-react-native';

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  items_json: any;
}

export default function OrdersScreen() {
  const { student } = useStudent();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    if (!student?.id) {
      setLoading(false);
      return;
    }

    try {
      // Önce orders tablosundan çek
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (ordersError) throw ordersError;

      // Ayrıca transactions tablosundan da çek (harcamalar ve yüklemeler)
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (transactionsError) throw transactionsError;

      // İkisini birleştir ve sırala
      const allOrders: any[] = [
        ...(ordersData || []).map(o => ({ ...o, source: 'order' })),
        ...(transactionsData || []).map(t => ({ 
          id: t.id,
          created_at: t.created_at,
          total_amount: t.amount,
          status: t.transaction_type === 'deposit' ? 'completed' : 'completed',
          items_json: t.items_json,
          source: 'transaction',
          transaction_type: t.transaction_type
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setOrders(allOrders);
    } catch (error) {
      console.error('Sipariş çekme hatası:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // CANLI SİPARİŞ GÜNCELLEMESİ
    if (!student?.id) return;

    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `student_id=eq.${student.id}`,
        },
        () => {
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `student_id=eq.${student.id}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [student?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} color="#10b981" />;
      case 'pending':
      case 'preparing':
      case 'ready':
        return <Clock size={16} color="#f59e0b" />;
      default:
        return <Clock size={16} color="#64748b" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'pending':
      case 'preparing':
      case 'ready':
        return '#f59e0b';
      default:
        return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Tamamlandı';
      case 'pending':
        return 'Beklemede';
      case 'preparing':
        return 'Hazırlanıyor';
      case 'ready':
        return 'Hazır';
      default:
        return status;
    }
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

  const formatOrderItems = (itemsJson: any) => {
    if (!itemsJson) return 'Ürün detayı yok';
    
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
    
    return 'Ürün detayı yok';
  };

  const renderOrder = ({ item }: { item: Order & { source?: string; transaction_type?: string } }) => (
    <TouchableOpacity style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          <Text style={styles.orderItems}>{formatOrderItems(item.items_json)}</Text>
        </View>
        {item.status && (
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
            {getStatusIcon(item.status)}
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.orderFooter}>
        <Text style={[
          styles.orderTotal,
          { color: item.transaction_type === 'deposit' ? '#10b981' : '#ef4444' }
        ]}>
          {item.transaction_type === 'deposit' ? '+' : ''}₺{item.total_amount.toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <ShoppingBag size={24} color="#ffffff" />
        <Text style={styles.headerTitle}>Siparişler</Text>
      </View>

      {loading && orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Yükleniyor...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyState}>
          <ShoppingBag size={64} color="#334155" />
          <Text style={styles.emptyStateText}>Henüz sipariş yok</Text>
          <Text style={styles.emptyStateSubtext}>Sipariş geçmişiniz burada görünecek</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
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
    padding: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 12,
  },
  list: {
    padding: 24,
    paddingTop: 0,
  },
  orderCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
  },
  orderItems: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
});


