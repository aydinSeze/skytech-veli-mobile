'use client'

import { useEffect, useState } from 'react'
import { getAdminStats, getRevenueReport } from '@/actions/admin-actions'
import { backupAllSchools, isBackupDoneToday } from '@/actions/backup-actions'
import {
    TrendingUp, TrendingDown, School, AlertTriangle,
    DollarSign, Activity, PieChart, ArrowUpRight, Download, Calendar
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

// Türkçe karakterleri latinize et
const latinify = (str: string) => {
    const mapping: { [key: string]: string } = {
        'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
    }
    return str.split('').map(char => mapping[char] || char).join('')
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)
    const [reportStartDate, setReportStartDate] = useState('')
    const [reportEndDate, setReportEndDate] = useState('')
    const [generatingReport, setGeneratingReport] = useState(false)

    useEffect(() => {
        const loadStats = async () => {
            const data = await getAdminStats()
            setStats(data)
            setLoading(false)
        }
        loadStats()

        // Varsayılan tarihleri ayarla (bu ayın başı ve bugün)
        const today = new Date()
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        setReportStartDate(firstDayOfMonth.toISOString().split('T')[0])
        setReportEndDate(today.toISOString().split('T')[0])

        // Günlük yedekleme kontrolü
        const checkAndBackup = async () => {
            try {
                const isDone = await isBackupDoneToday()
                
                if (!isDone) {
                    // Bugün yedekleme yapılmamış, sessizce başlat
                    const toastId = toast.loading('Günlük yedekleme kontrol ediliyor...', {
                        position: 'top-right'
                    })
                    
                    const result = await backupAllSchools()
                    
                    // Toast'ı kapat
                    toast.dismiss(toastId)
                    
                    if (result.success) {
                        // Başarılı mesajı göster
                        toast.success(`Tüm okulların günlük yedeği alındı. ${result.successCount || 0} okul başarıyla yedeklendi.`, {
                            position: 'top-right',
                            duration: 5000
                        })
                    } else {
                        // Hata mesajı göster
                        toast.error(result.message || 'Yedekleme sırasında bir hata oluştu.', {
                            position: 'top-right',
                            duration: 7000
                        })
                    }
                }
                // Bugün zaten yedekleme yapılmışsa sessizce geç
            } catch (error: any) {
                console.error('Yedekleme kontrolü hatası:', error)
                toast.error('Yedekleme kontrolü sırasında bir hata oluştu.', {
                    position: 'top-right',
                    duration: 5000
                })
            }
        }

        // Sayfa yüklendiğinde kontrol et
        checkAndBackup()
    }, [])

    const handleGenerateReport = async () => {
        if (!reportStartDate || !reportEndDate) {
            alert('Lütfen başlangıç ve bitiş tarihlerini seçin.')
            return
        }

        if (new Date(reportStartDate) > new Date(reportEndDate)) {
            alert('Başlangıç tarihi bitiş tarihinden sonra olamaz.')
            return
        }

        setGeneratingReport(true)
        try {
            const reportData = await getRevenueReport(reportStartDate, reportEndDate)
            
            if (!reportData) {
                alert('Rapor oluşturulurken bir hata oluştu.')
                return
            }

            // PDF oluştur
            const doc = new jsPDF()

            // Başlık
            doc.setFontSize(18)
            doc.text('SkyTech Yonetim Paneli - Gelir Raporu', 14, 22)

            // Tarih aralığı
            doc.setFontSize(12)
            doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30)
            doc.text(`Tarih Araligi: ${reportData.startDate} - ${reportData.endDate}`, 14, 36)

            // Özet bilgiler
            doc.setFontSize(14)
            doc.text('Ozet Bilgiler', 14, 48)
            autoTable(doc, {
                startY: 52,
                head: [['Kalem', 'Tutar']],
                body: [
                    ['Toplam Satis Sayisi', `${reportData.totalSales} adet`],
                    ['Komisyon Orani', `${reportData.commissionRate.toFixed(2)} TL`],
                    ['Toplam Gelir', `${reportData.totalRevenue.toFixed(2)} TL`]
                ],
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { cellWidth: 60, halign: 'right' }
                },
                didParseCell: function (data) {
                    if (data.cell.text) {
                        // Sadece string değerleri latinize et, sayıları olduğu gibi bırak
                        data.cell.text = data.cell.text.map((t: any) => {
                            if (typeof t === 'string') {
                                // Sayı içeren string'leri kontrol et (örn: "2.20 TL", "22 adet")
                                if (/^\d+\.?\d*\s*(TL|adet|$)/.test(t.trim())) {
                                    return t // Sayı içeren string'leri olduğu gibi bırak
                                }
                                return latinify(t)
                            }
                            return t
                        })
                    }
                }
            })

            // Günlük Gelir Tablosu
            if (reportData.dailyData.length > 0) {
                const startY = (doc as any).lastAutoTable.finalY + 15
                doc.setFontSize(14)
                doc.text('Gunluk Gelir Detayi', 14, startY)
                autoTable(doc, {
                    startY: startY + 5,
                    head: [['Tarih', 'Gunluk Gelir (TL)']],
                    body: reportData.dailyData.map(d => [
                        d.date,
                        `${d.revenue.toFixed(2)} TL`
                    ]),
                    theme: 'grid',
                    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
                    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
                    columnStyles: {
                        0: { cellWidth: 60 },
                        1: { cellWidth: 50, halign: 'right' }
                    },
                    didParseCell: function (data) {
                        if (data.cell.text) {
                            // Sadece string değerleri latinize et, sayıları olduğu gibi bırak
                            data.cell.text = data.cell.text.map((t: any) => {
                                if (typeof t === 'string') {
                                    // Sayı içeren string'leri kontrol et
                                    if (/^\d+\.?\d*\s*TL$/.test(t.trim()) || /^\d{2}\.\d{2}\.\d{4}$/.test(t.trim())) {
                                        return t // Tarih ve sayı formatlarını olduğu gibi bırak
                                    }
                                    return latinify(t)
                                }
                                return t
                            })
                        }
                    }
                })
            }

            // Aylık Gelir Tablosu
            if (reportData.monthlyData.length > 0) {
                const startY = (doc as any).lastAutoTable.finalY + 15
                doc.setFontSize(14)
                doc.text('Aylik Gelir Ozeti', 14, startY)
                autoTable(doc, {
                    startY: startY + 5,
                    head: [['Ay', 'Aylik Gelir (TL)']],
                    body: reportData.monthlyData.map(m => [
                        latinify(m.month),
                        `${m.revenue.toFixed(2)} TL`
                    ]),
                    theme: 'grid',
                    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
                    headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
                    columnStyles: {
                        0: { cellWidth: 'auto' },
                        1: { cellWidth: 50, halign: 'right' }
                    },
                    didParseCell: function (data) {
                        if (data.cell.text) {
                            // Sadece string değerleri latinize et, sayıları olduğu gibi bırak
                            data.cell.text = data.cell.text.map((t: any) => {
                                if (typeof t === 'string') {
                                    // Sayı içeren string'leri kontrol et
                                    if (/^\d+\.?\d*\s*TL$/.test(t.trim())) {
                                        return t // Sayı formatlarını olduğu gibi bırak
                                    }
                                    return latinify(t)
                                }
                                return t
                            })
                        }
                    }
                })
            }

            // Alt bilgi
            const pageHeight = doc.internal.pageSize.height
            doc.setFontSize(8)
            doc.setTextColor(100)
            doc.text('Bu rapor SkyTech Yazilim Hizmetleri altyapisi ile olusturulmustur.', 105, pageHeight - 15, { align: 'center' })
            doc.text('Kurucu: Aydin SEZER - Iletisim: 0546 436 25 50', 105, pageHeight - 10, { align: 'center' })

            // PDF'i indir
            const fileName = `Gelir_Raporu_${reportStartDate.replace(/-/g, '_')}_${reportEndDate.replace(/-/g, '_')}.pdf`
            doc.save(fileName)

            setIsReportModalOpen(false)
            alert('Rapor başarıyla oluşturuldu ve indirildi!')
        } catch (error: any) {
            console.error('Rapor oluşturma hatası:', error)
            alert('Rapor oluşturulurken bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'))
        } finally {
            setGeneratingReport(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-white p-8 space-y-8 font-sans">
            {/* BAŞLIK */}
            <div className="flex justify-between items-end border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-500 bg-clip-text text-transparent">
                        SkyTech İmparatorluğu
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg">Yönetim Paneli ve Finansal Genel Bakış</p>
                </div>
                <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg"
                >
                    <Download size={20} />
                    Gelir Raporu İndir
                </button>
            </div>

            {/* İSTATİSTİK KARTLARI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* TOPLAM HASILAT */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-2xl border border-yellow-500/20 shadow-lg shadow-yellow-900/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign size={100} className="text-yellow-500" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-yellow-500/20 rounded-xl text-yellow-400">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-slate-400 font-medium">Toplam Hasılat</span>
                    </div>
                    <div className="text-4xl font-bold text-white mb-1">
                        ₺{stats?.totalRevenue?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </div>
                    <div className="text-xs text-green-400 flex items-center gap-1">
                        <ArrowUpRight size={12} /> Tüm Zamanlar Komisyon Toplamı
                    </div>
                </div>

                {/* GÜNLÜK GELİR */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-2xl border border-green-500/20 shadow-lg shadow-green-900/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={100} className="text-green-500" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-500/20 rounded-xl text-green-400">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-slate-400 font-medium">Günlük Gelir</span>
                    </div>
                    <div className="text-4xl font-bold text-white mb-1">
                        ₺{stats?.dailyRevenue?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </div>
                    <div className="text-xs text-green-400 flex items-center gap-1">
                        Bugünkü Komisyon Toplamı
                    </div>
                </div>

                {/* AYLIK GELİR */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-900/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={100} className="text-indigo-500" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-slate-400 font-medium">Aylık Gelir</span>
                    </div>
                    <div className="text-4xl font-bold text-white mb-1">
                        ₺{stats?.monthlyRevenue?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </div>
                    <div className="text-xs text-indigo-400 flex items-center gap-1">
                        Bu Ayki Komisyon Toplamı
                    </div>
                </div>

                {/* AKTİF OKULLAR */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-900/10 relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                            <School size={24} />
                        </div>
                        <span className="text-slate-400 font-medium">Aktif Okullar</span>
                    </div>
                    <div className="text-4xl font-bold text-white mb-1">
                        {stats?.activeSchools || 0}
                    </div>
                    <div className="text-xs text-blue-400">
                        Sistemdeki Toplam Okul
                    </div>
                </div>
            </div>

            {/* GRAFİK */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <PieChart className="text-indigo-500" />
                    Tahsilat Analizi (Son 6 Ay) - Sistem Kredisi Komisyonları
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                    Her ay kullanıcı panellerinde harcanan sistem kredilerinden düşen komisyonların aylık toplamı
                </p>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.chartData || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="name" stroke="#666" />
                            <YAxis stroke="#666" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                itemStyle={{ color: '#fbbf24' }}
                                formatter={(value: any) => [`₺${value.toFixed(2)}`, 'Komisyon']}
                            />
                            <Bar dataKey="total" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* GELİR RAPORU MODAL */}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 p-8 rounded-2xl w-full max-w-md border border-yellow-500/30 shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Calendar className="text-yellow-400" />
                            Gelir Raporu Oluştur
                        </h2>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Başlangıç Tarihi</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-800 text-white p-3 rounded-lg border border-slate-700 focus:ring-2 focus:ring-yellow-500 outline-none"
                                    value={reportStartDate}
                                    onChange={(e) => setReportStartDate(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Bitiş Tarihi</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-800 text-white p-3 rounded-lg border border-slate-700 focus:ring-2 focus:ring-yellow-500 outline-none"
                                    value={reportEndDate}
                                    onChange={(e) => setReportEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-lg mb-6">
                            <p className="text-sm text-yellow-300">
                                <strong>ℹ️ Bilgi:</strong> Seçilen tarih aralığındaki tüm satışlardan düşen komisyonlar günlük ve aylık olarak PDF'ye yazılacaktır.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsReportModalOpen(false)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-bold transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleGenerateReport}
                                disabled={generatingReport || !reportStartDate || !reportEndDate}
                                className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-black py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                {generatingReport ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black"></div>
                                        Oluşturuluyor...
                                    </>
                                ) : (
                                    <>
                                        <Download size={18} />
                                        PDF İndir
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
