
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Settings as SettingsIcon, Save, RefreshCw, Building2, Globe, FileText, Target, Users, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

export default function Settings() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        industry: '',
        description: '',
        website_url: '',
        employee_count: '',
        annual_revenue: '',
        monthly_budget: '',
        target_market: '',
        challenges: ''
    });
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const employeeOptions = [
        { value: '1-5', label: '1-5 Kişi (Mikro)' },
        { value: '6-20', label: '6-20 Kişi (Küçük)' },
        { value: '21-50', label: '21-50 Kişi (Orta-Küçük)' },
        { value: '51-200', label: '51-200 Kişi (Orta)' },
        { value: '201-1000', label: '201-1000 Kişi (Büyük)' },
        { value: '1000+', label: '1000+ Kişi (Kurumsal)' }
    ];

    const revenueOptions = [
        { value: '0-100k', label: '0 - 100.000 ₺ / yıl' },
        { value: '100k-500k', label: '100.000 - 500.000 ₺ / yıl' },
        { value: '500k-2m', label: '500.000 - 2 Milyon ₺ / yıl' },
        { value: '2m-10m', label: '2 - 10 Milyon ₺ / yıl' },
        { value: '10m-50m', label: '10 - 50 Milyon ₺ / yıl' },
        { value: '50m+', label: '50+ Milyon ₺ / yıl' }
    ];

    const budgetOptions = [
        { value: '0-5k', label: '0 - 5.000 ₺ / ay' },
        { value: '5k-20k', label: '5.000 - 20.000 ₺ / ay' },
        { value: '20k-100k', label: '20.000 - 100.000 ₺ / ay' },
        { value: '100k-500k', label: '100.000 - 500.000 ₺ / ay' },
        { value: '500k+', label: '500.000+ ₺ / ay' }
    ];

    useEffect(() => {
        const fetchOrgData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }
            setUser(session.user);

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', session.user.id)
                .single();

            if (profile?.organization_id) {
                const { data: org } = await supabase
                    .from('organizations')
                    .select('*')
                    .eq('id', profile.organization_id)
                    .single();

                if (org) {
                    setFormData({
                        id: org.id,
                        name: org.name || '',
                        industry: org.industry || '',
                        description: org.description || '',
                        website_url: org.website_url || '',
                        employee_count: org.employee_count || '',
                        annual_revenue: org.annual_revenue || '',
                        monthly_budget: org.monthly_budget || '',
                        target_market: org.target_market || '',
                        challenges: org.challenges || ''
                    });
                }
            }
            setLoading(false);
        };

        fetchOrgData();
    }, [router]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('organizations')
                .update({
                    name: formData.name,
                    industry: formData.industry,
                    description: formData.description,
                    website_url: formData.website_url,
                    employee_count: formData.employee_count,
                    annual_revenue: formData.annual_revenue,
                    monthly_budget: formData.monthly_budget,
                    target_market: formData.target_market,
                    challenges: formData.challenges
                })
                .eq('id', formData.id);

            if (error) throw error;
            setMessage({ text: 'Bilgiler başarıyla güncellendi!', type: 'success' });
        } catch (error: any) {
            console.error('Update error:', error);
            setMessage({ text: 'Güncelleme hatası: ' + error.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex bg-slate-50 min-h-screen">
                <Sidebar user={user} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex bg-slate-50 min-h-screen font-sans text-slate-900">
            <Sidebar user={user} />

            <main className="flex-1 p-8 overflow-y-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <SettingsIcon className="w-8 h-8 text-slate-700" />
                        Şirket Ayarları
                    </h1>
                    <p className="text-slate-500 mt-2">Şirket profilinizi ve AI bağlamını buradan yönetebilirsiniz.</p>
                </header>

                <div className="max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    {message && (
                        <div className={`p-4 rounded-xl mb-6 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {message.type === 'success' ? <RefreshCw className="w-5 h-5" /> : null}
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleUpdate} className="space-y-6">
                        {/* Row 1: Name & Industry */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-blue-600" /> Şirket Adı
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-blue-600" /> Sektör
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.industry}
                                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                />
                            </div>
                        </div>

                        {/* Row 2: Employee Count & Annual Revenue */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-600" /> Çalışan Sayısı
                                </label>
                                <select
                                    value={formData.employee_count}
                                    onChange={(e) => setFormData({ ...formData, employee_count: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                >
                                    <option value="">Seçiniz...</option>
                                    {employeeOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-blue-600" /> Yıllık Ciro
                                </label>
                                <select
                                    value={formData.annual_revenue}
                                    onChange={(e) => setFormData({ ...formData, annual_revenue: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                >
                                    <option value="">Seçiniz...</option>
                                    {revenueOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 3: Monthly Budget & Website */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-blue-600" /> Aylık Yatırım Bütçesi
                                </label>
                                <select
                                    value={formData.monthly_budget}
                                    onChange={(e) => setFormData({ ...formData, monthly_budget: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                >
                                    <option value="">Seçiniz...</option>
                                    {budgetOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-blue-600" /> Web Sitesi
                                </label>
                                <input
                                    type="url"
                                    value={formData.website_url}
                                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                />
                            </div>
                        </div>

                        {/* Row 4: Target Market */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Target className="w-4 h-4 text-blue-600" /> Hedef Kitle / Pazar
                            </label>
                            <input
                                type="text"
                                value={formData.target_market}
                                onChange={(e) => setFormData({ ...formData, target_market: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                placeholder="Örn: Türkiye'deki 25-45 yaş arası profesyoneller..."
                            />
                        </div>

                        {/* Row 5: Challenges */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-500" /> Mevcut Zorluklar / Hedefler
                            </label>
                            <textarea
                                rows={3}
                                value={formData.challenges}
                                onChange={(e) => setFormData({ ...formData, challenges: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                placeholder="Örn: Nakit akışı sıkıntımız var. Büyümek istiyoruz ama kaynak sınırlı..."
                            />
                        </div>

                        {/* Row 6: Description */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-600" /> Şirket Tanımı
                            </label>
                            <textarea
                                rows={2}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                placeholder="Kısaca ne yapıyorsunuz?"
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-lg hover:shadow-xl disabled:opacity-70"
                            >
                                {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}

