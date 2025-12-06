'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'

export default function CanteensPage() {
    const supabase = createClientComponentClient()
    const [schools, setSchools] = useState<any[]>([])
    const [canteens, setCanteens] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ name: '', school_id: '' })

    // Verileri Çekme Fonksiyonu
    const fetchData = async () => {
        try {
            setLoading(true)
            console.log('Veri çekme başladı...')

            // 1. Okulları Çek
            const { data: schoolData, error: schoolError } = await supabase.from('schools').select('*')
            if (schoolError) {
                console.error('Okul Hatası:', schoolError)
            } else {
                console.log('Gelen Okullar:', schoolData)
                setSchools(schoolData || [])
            }

            // 2. Kantinleri Çek
            const { data: canteenData, error: canteenError } = await supabase
                .from('canteens')
                .select('*, schools(name)')

            if (canteenError) console.error('Kantin Hatası:', canteenError)
            else setCanteens(canteenData || [])

        } catch (error) {
            console.error('Genel Hata:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // Kantin Kaydetme
    const handleSave = async () => {
        if (!form.name || !form.school_id) {
            alert('Lütfen okul ve kantin adı girin!')
            return
        }

        const { error } = await supabase.from('canteens').insert([
            { name: form.name, school_id: form.school_id }
        ])

        if (error) alert('Hata: ' + error.message)
        else {
            alert('Kantin Eklendi!')
            setForm({ name: '', school_id: '' })
            fetchData() // Listeyi yenile
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Kantin Listesi</h1>
            </div>

            {/* EKLEME FORMU */}
            <div className="bg-slate-800 p-4 rounded-lg flex gap-4 items-end">
                <div className="flex-1">
                    <label className="block text-sm text-slate-400 mb-1">Kantin Adı</label>
                    <input
                        type="text"
                        className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        placeholder="Örn: Ana Kantin"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-sm text-slate-400 mb-1">Okul Seçiniz</label>
                    <select
                        className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={form.school_id}
                        onChange={e => setForm({ ...form, school_id: e.target.value })}
                    >
                        <option value="">Seçiniz...</option>
                        {schools.map(school => (
                            <option key={school.id} value={school.id}>{school.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleSave}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold"
                >
                    Kaydet
                </button>
            </div>

            {/* LİSTE */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400">
                        <tr>
                            <th className="p-4">Kantin Adı</th>
                            <th className="p-4">Okul</th>
                            <th className="p-4">Kayıt Tarihi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {canteens.map(canteen => (
                            <tr key={canteen.id} className="border-b border-slate-700">
                                <td className="p-4">{canteen.name}</td>
                                <td className="p-4">{canteen.schools?.name}</td>
                                <td className="p-4">{new Date(canteen.created_at).toLocaleDateString('tr-TR')}</td>
                            </tr>
                        ))}
                        {canteens.length === 0 && (
                            <tr>
                                <td colSpan={3} className="p-4 text-center text-slate-500">Henüz kantin yok.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
