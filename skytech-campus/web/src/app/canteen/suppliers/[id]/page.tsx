'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export const dynamic = 'force-dynamic'

// Türkçe karakterleri İngilizce karşılıklarına çeviren yardımcı fonksiyon (PDF için)
const latinify = (str: string) => {
    if (!str) return ''
    const mapping: { [key: string]: string } = {
        'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S',
        'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ç': 'c', 'Ç': 'C'
    }
    return str.split('').map(char => mapping[char] || char).join('')
}

export default function SupplierDetailPage() {
    const params = useParams()
    const supplierId = params?.id as string
    const supabase = createClient()

    const [supplier, setSupplier] = useState<any>(null)
    const [products, setProducts] = useState<any[]>([])

    // Sipariş State'i: { urunId: { quantity: 5, price: 10 } }
    const [orders, setOrders] = useState<{ [key: string]: { quantity: number, price: number } }>({})

    // Serbest Ürünler State'i
    const [customItems, setCustomItems] = useState<{ id: string, name: string, quantity: number, price: number }[]>([])

    const [loading, setLoading] = useState(true)
    const [schoolName, setSchoolName] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            if (!supplierId) return
            setLoading(true)
            try {
                // 1. Kullanıcı ve Okul Bilgilerini Çek
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    alert('Oturum bulunamadı! Lütfen giriş yapın.')
                    setLoading(false)
                    return
                }

                const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
                if (!profile?.school_id) {
                    alert('Okul bilgisi bulunamadı!')
                    setLoading(false)
                    return
                }

                // Okul Adını Çek
                const { data: school } = await supabase.from('schools').select('name').eq('id', profile.school_id).single()
                if (school) setSchoolName(school.name.toUpperCase())

                // 2. Firma Bilgilerini Çek (School ID kontrolü ile)
                const { data: supplierData, error: supplierError } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('id', supplierId)
                    .eq('school_id', profile.school_id)
                    .single()
                
                if (supplierError || !supplierData) {
                    console.error('Firma bulunamadı:', supplierError)
                    alert('Firma bulunamadı veya bu okula ait değil!')
                    setLoading(false)
                    return
                }
                
                setSupplier(supplierData)

                // 3. Firmaya Ait Ürünleri Çek (School ID kontrolü ile)
                const { data: productData } = await supabase
                    .from('products')
                    .select('*')
                    .eq('supplier_id', supplierId)
                    .eq('school_id', profile.school_id)
                    .order('name', { ascending: true })

                setProducts(productData || [])

                // 4. Varsayılan Fiyatları State'e Yükle
                if (productData) {
                    const initialOrders: any = {}
                    productData.forEach((p: any) => {
                        initialOrders[p.id] = {
                            quantity: 0,
                            price: p.buying_price || 0
                        }
                    })
                    setOrders(initialOrders)
                }

            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [supplierId, supabase])

    // Mevcut Ürün Sipariş Güncelleme
    const handleOrderChange = (productId: string, field: 'quantity' | 'price', value: string) => {
        setOrders(prev => {
            const currentOrder = prev[productId] || { quantity: 0, price: 0 }
            let newValue: any = value

            if (field === 'quantity' || field === 'price') {
                const numVal = parseFloat(value)
                newValue = isNaN(numVal) || numVal < 0 ? 0 : numVal
            }

            return {
                ...prev,
                [productId]: {
                    ...currentOrder,
                    [field]: newValue
                }
            }
        })
    }

    // Serbest Ürün Ekleme
    const addCustomItem = () => {
        const newItem = {
            id: `custom-${Date.now()}`,
            name: '',
            quantity: 1,
            price: 0
        }
        setCustomItems([...customItems, newItem])
    }

    // Serbest Ürün Güncelleme
    const updateCustomItem = (id: string, field: 'name' | 'quantity' | 'price', value: string) => {
        setCustomItems(prev => prev.map(item => {
            if (item.id === id) {
                if (field === 'name') return { ...item, name: value.toUpperCase() }

                const numVal = parseFloat(value)
                return { ...item, [field]: isNaN(numVal) ? 0 : numVal }
            }
            return item
        }))
    }

    // Serbest Ürün Silme
    const removeCustomItem = (id: string) => {
        setCustomItems(prev => prev.filter(item => item.id !== id))
    }

    // PDF İndir
    const handlePdf = () => {
        const doc = new jsPDF()
        const dateStr = new Date().toLocaleDateString('tr-TR')

        // Sipariş edilen mevcut ürünler
        const selectedProducts = products.filter(p => orders[p.id]?.quantity > 0).map(p => ({
            name: p.name,
            barcode: p.barcode || '-',
            quantity: orders[p.id].quantity,
            price: orders[p.id].price || 0,
            isCustom: false
        }))

        // Serbest ürünler
        const validCustomItems = customItems.filter(i => i.name && i.quantity > 0).map(i => ({
            name: i.name,
            barcode: '-',
            quantity: i.quantity,
            price: i.price,
            isCustom: true
        }))

        const allItems = [...selectedProducts, ...validCustomItems]

        if (allItems.length === 0) return alert('Lütfen en az bir ürün için adet giriniz.')

        // Başlık
        doc.setFontSize(18)
        doc.text(latinify(`SIPARIS FORMU - ${supplier.name}`), 14, 20)

        doc.setFontSize(12)
        doc.text(latinify(`Alici: ${schoolName}`), 14, 30)
        doc.text(`Tarih: ${dateStr}`, 14, 36)

        // Tablo Verisi
        const tableData = allItems.map(item => [
            latinify(item.name) + (item.isCustom ? ' (Ekstra)' : ''),
            item.barcode,
            item.price > 0 ? item.price + ' TL' : '-',
            item.quantity,
            item.price > 0 ? (item.quantity * item.price).toFixed(2) + ' TL' : '-'
        ])

        // Toplam Tutar Hesapla
        const totalAmount = allItems.reduce((sum, item) => sum + (item.quantity * item.price), 0)
        if (totalAmount > 0) {
            tableData.push(['TOPLAM', '', '', '', totalAmount.toFixed(2) + ' TL'])
        }

        autoTable(doc, {
            startY: 45,
            head: [['Urun Adi', 'Barkod', 'Birim Fiyat', 'Siparis Miktari (Koli)', 'Tutar']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 37, 36] }, // Slate-800 benzeri koyu renk
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 30, halign: 'center' },
                2: { cellWidth: 30, halign: 'right' },
                3: { cellWidth: 35, halign: 'center' },
                4: { cellWidth: 30, halign: 'right' }
            }
        })

        // İMZA ALANI
        const pageHeight = doc.internal.pageSize.height
        const finalY = (doc as any).lastAutoTable?.finalY || 120
        const signatureY = finalY + 20
        
        doc.setFontSize(10)
        doc.text(latinify("Imza:"), 14, signatureY)
        doc.line(14, signatureY + 5, 80, signatureY + 5) // İmza çizgisi
        
        // ALT BİLGİ (FOOTER)
        doc.setFontSize(8)
        doc.setTextColor(100)
        doc.text(latinify("Bu siparis listesi SkyTech Yazilim Hizmetleri altyapisi ile olusturulmustur."), 105, pageHeight - 15, { align: 'center' })
        doc.text(latinify("Kurucu: Aydin SEZER - Iletisim: 0546 436 25 50"), 105, pageHeight - 10, { align: 'center' })

        doc.save(`${latinify(supplier.name)}_Siparis_${dateStr}.pdf`)
    }

    // WhatsApp Gönder - PDF ile birlikte
    const handleWhatsApp = () => {
        try {
            const dateStr = new Date().toLocaleDateString('tr-TR')

            if (!supplier || !supplier.phone) {
                alert('Firmanın telefon numarası kayıtlı değil.')
                return
            }

            const selectedProducts = products.filter(p => orders[p.id]?.quantity > 0).map(p => ({
                name: p.name,
                barcode: p.barcode || '-',
                quantity: orders[p.id].quantity,
                price: orders[p.id].price || 0,
                isCustom: false
            }))

            const validCustomItems = customItems.filter(i => i.name && i.quantity > 0).map(i => ({
                name: i.name,
                barcode: '-',
                quantity: i.quantity,
                price: i.price,
                isCustom: true
            }))

            const allItems = [...selectedProducts, ...validCustomItems]

            if (allItems.length === 0) {
                alert('Lütfen en az bir ürün için adet giriniz.')
                return
            }

            // Önce PDF oluştur
            const doc = new jsPDF()
            
            // PDF içeriği
            doc.setFontSize(18)
            doc.text(latinify(`SIPARIS FORMU - ${supplier.name}`), 14, 20)

            doc.setFontSize(12)
            doc.text(latinify(`Alici: ${schoolName || 'Kantin'}`), 14, 30)
            doc.text(`Tarih: ${dateStr}`, 14, 36)

            const tableData = allItems.map(item => [
                latinify(item.name) + (item.isCustom ? ' (Ekstra)' : ''),
                item.barcode,
                item.price > 0 ? item.price + ' TL' : '-',
                item.quantity,
                item.price > 0 ? (item.quantity * item.price).toFixed(2) + ' TL' : '-'
            ])

            const totalAmount = allItems.reduce((sum, item) => sum + (item.quantity * item.price), 0)
            if (totalAmount > 0) {
                tableData.push(['TOPLAM', '', '', '', totalAmount.toFixed(2) + ' TL'])
            }

            autoTable(doc, {
                startY: 45,
                head: [['Urun Adi', 'Barkod', 'Birim Fiyat', 'Siparis Miktari (Koli)', 'Tutar']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [41, 37, 36] },
                styles: { fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { cellWidth: 30, halign: 'center' },
                    2: { cellWidth: 30, halign: 'right' },
                    3: { cellWidth: 35, halign: 'center' },
                    4: { cellWidth: 30, halign: 'right' }
                }
            })

            const pageHeight = doc.internal.pageSize.height
            const finalY = (doc as any).lastAutoTable?.finalY || 120
            const signatureY = finalY + 20
            
            // İMZA ALANI
            doc.setFontSize(10)
            doc.text(latinify("Imza:"), 14, signatureY)
            doc.line(14, signatureY + 5, 80, signatureY + 5) // İmza çizgisi
            
            // ALT BİLGİ (FOOTER)
            doc.setFontSize(8)
            doc.setTextColor(100)
            doc.text(latinify("Bu siparis listesi SkyTech Yazilim Hizmetleri altyapisi ile olusturulmustur."), 105, pageHeight - 15, { align: 'center' })
            doc.text(latinify("Kurucu: Aydin SEZER - Iletisim: 0546 436 25 50"), 105, pageHeight - 10, { align: 'center' })

            // PDF'i blob olarak al
            const pdfBlob = doc.output('blob')
            const pdfUrl = URL.createObjectURL(pdfBlob)
            const fileName = `${latinify(supplier.name)}_Siparis_${dateStr.replace(/\//g, '-')}.pdf`

            // PDF'i indir
            const link = document.createElement('a')
            link.href = pdfUrl
            link.download = fileName
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(pdfUrl)

            // Telefon numarasını formatla
            let phone = supplier.phone.replace(/\D/g, '')
            if (phone.startsWith('0')) {
                phone = '90' + phone.substring(1)
            } else if (phone.startsWith('90')) {
                phone = phone
            } else if (phone.startsWith('5') && phone.length === 10) {
                phone = '90' + phone
            } else if (phone.length === 10) {
                phone = '90' + phone
            }

            // Detaylı sipariş mesajı oluştur (PDF olmadan da anlaşılır olsun)
            let message = `Merhaba, ${schoolName || 'Kantin'} Kantini siparişidir (${dateStr}):%0A%0A`

            selectedProducts.forEach(p => {
                if (p.quantity > 0) {
                    message += `• ${p.name}: ${p.quantity} Koli`
                    if (p.price > 0) message += ` (Birim: ${p.price} TL)`
                    message += `%0A`
                }
            })

            if (validCustomItems.length > 0) {
                message += `%0A--- EKSTRA ÜRÜNLER ---%0A`
                validCustomItems.forEach(i => {
                    message += `• ${i.name}: ${i.quantity} Koli`
                    if (i.price > 0) message += ` (Birim: ${i.price} TL)`
                    message += `%0A`
                })
            }

            if (totalAmount > 0) {
                message += `%0AToplam: ${totalAmount.toFixed(2)} TL%0A`
            }

            message += `%0ADetaylı sipariş listesi PDF dosyası olarak indirilmiştir. Lütfen PDF dosyasını bu sohbete ekleyiniz.`

            // WhatsApp Web'i aç (yeni sekmede)
            const whatsappUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${message}`
            
            // Önce PDF indirilsin, sonra WhatsApp açılsın
            setTimeout(() => {
                // WhatsApp Web'i yeni sekmede aç
                const whatsappWindow = window.open(whatsappUrl, '_blank')
                
                // Kullanıcıya net talimat ver
                if (whatsappWindow) {
                    alert(
                        '✅ PDF dosyası indirildi!\n\n' +
                        '📱 WhatsApp Web açıldı.\n\n' +
                        '📎 PDF\'i eklemek için:\n' +
                        '1. İndirilen PDF dosyasını bulun (genellikle İndirilenler klasöründe)\n' +
                        '2. WhatsApp Web\'deki sohbete PDF\'i sürükle-bırak yapın\n' +
                        'VEYA\n' +
                        '3. WhatsApp Web\'deki 📎 (ekle) butonuna tıklayıp PDF\'i seçin\n\n' +
                        'PDF dosyası: ' + fileName
                    )
                } else {
                    alert(
                        '✅ PDF dosyası indirildi!\n\n' +
                        '⚠️ Popup engelleyicisi aktif. Lütfen:\n' +
                        '1. Tarayıcı ayarlarından popup\'ları açın\n' +
                        '2. WhatsApp Web\'i manuel olarak açın: https://web.whatsapp.com\n' +
                        '3. PDF dosyasını sohbete ekleyin\n\n' +
                        'PDF dosyası: ' + fileName
                    )
                }
            }, 1000)

        } catch (error) {
            console.error('WhatsApp hatası:', error)
            alert('WhatsApp gönderilirken bir hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'))
        }
    }

    if (loading) return <div className="p-10 text-white">Yükleniyor...</div>
    if (!supplier) return <div className="p-10 text-white">Firma bulunamadı.</div>

    return (
        <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-200">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">{supplier.name}</h1>
                    <p className="text-slate-400 text-sm">Sipariş Oluşturma Ekranı • {new Date().toLocaleDateString('tr-TR')}</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handlePdf} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2 shadow-lg hover:shadow-red-900/20 transition-all">
                        📄 PDF İndir
                    </button>
                    <button onClick={handleWhatsApp} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2 shadow-lg hover:shadow-green-900/20 transition-all">
                        📱 WhatsApp
                    </button>
                </div>
            </div>

            {/* ÜRÜN TABLOSU */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-xs tracking-wider">
                        <tr>
                            <th className="p-4">Ürün Adı</th>
                            <th className="p-4">Barkod</th>
                            <th className="p-4 text-center">Stok</th>
                            <th className="p-4 w-32 text-center">Birim Fiyat (TL)</th>
                            <th className="p-4 w-48 text-center">SİPARİŞ MİKTARI (KOLİ ADETİ)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {products.map(product => (
                            <tr key={product.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="p-4 font-medium text-white">{product.name}</td>
                                <td className="p-4 font-mono text-sm text-slate-500">{product.barcode}</td>
                                <td className={`p-4 text-center font-bold ${product.stock_quantity < 10 ? 'text-red-500' : 'text-green-400'}`}>
                                    {product.stock_quantity}
                                </td>
                                <td className="p-4">
                                    <input
                                        type="number" min="0" step="0.5"
                                        className="w-full bg-slate-950 text-white p-2 rounded border border-slate-700 focus:border-indigo-500 text-center"
                                        placeholder="Opsiyonel"
                                        value={orders[product.id]?.price || ''}
                                        onChange={(e) => handleOrderChange(product.id, 'price', e.target.value)}
                                    />
                                </td>
                                <td className="p-4">
                                    <input
                                        type="number" min="0"
                                        className="w-full bg-slate-950 text-white p-2 rounded border border-slate-700 focus:border-indigo-500 text-center font-bold text-lg"
                                        placeholder="0"
                                        value={orders[product.id]?.quantity || ''}
                                        onChange={(e) => handleOrderChange(product.id, 'quantity', e.target.value)}
                                    />
                                </td>
                            </tr>
                        ))}

                        {/* SERBEST ÜRÜNLER */}
                        {customItems.map((item) => (
                            <tr key={item.id} className="bg-indigo-900/10 hover:bg-indigo-900/20 border-l-4 border-indigo-500 transition-colors">
                                <td className="p-4" colSpan={2}>
                                    <input
                                        type="text"
                                        className="w-full bg-transparent text-indigo-200 placeholder-indigo-400/50 focus:outline-none border-b border-indigo-500/30 focus:border-indigo-400"
                                        placeholder="Serbest Ürün Adı Giriniz..."
                                        value={item.name}
                                        onChange={(e) => updateCustomItem(item.id, 'name', e.target.value)}
                                        autoFocus
                                    />
                                </td>
                                <td className="p-4 text-center">
                                    <button onClick={() => removeCustomItem(item.id)} className="text-red-400 hover:text-red-300 text-sm font-medium">
                                        Sil
                                    </button>
                                </td>
                                <td className="p-4">
                                    <input
                                        type="number" min="0" step="0.5"
                                        className="w-full bg-slate-950 text-white p-2 rounded border border-indigo-500/50 focus:border-indigo-400 text-center"
                                        placeholder="Fiyat"
                                        value={item.price || ''}
                                        onChange={(e) => updateCustomItem(item.id, 'price', e.target.value)}
                                    />
                                </td>
                                <td className="p-4">
                                    <input
                                        type="number" min="1"
                                        className="w-full bg-slate-950 text-white p-2 rounded border border-indigo-500/50 focus:border-indigo-400 text-center font-bold text-lg"
                                        value={item.quantity}
                                        onChange={(e) => updateCustomItem(item.id, 'quantity', e.target.value)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* SERBEST ÜRÜN EKLE BUTONU */}
                <div className="p-4 bg-slate-900 border-t border-slate-800">
                    <button
                        onClick={addCustomItem}
                        className="w-full py-3 border-2 border-dashed border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 rounded-lg transition-all flex items-center justify-center gap-2 font-medium"
                    >
                        <span>➕</span> Serbest Ürün Ekle (Listede Olmayan)
                    </button>
                </div>
            </div>
        </div>
    )
}
