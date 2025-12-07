
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Zap, Building2, Globe, FileText, Target, Users, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';

export default function Onboarding() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
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

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) router.push('/login');
        };
        checkUser();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            const { data: orgId, error: rpcError } = await supabase.rpc('create_new_organization', {
                org_name: formData.name,
                org_industry: formData.industry,
                org_description: formData.description,
                org_website: formData.website_url,
                org_employee_count: formData.employee_count,
                org_annual_revenue: formData.annual_revenue,
                org_monthly_budget: formData.monthly_budget,
                org_target_market: formData.target_market,
                org_challenges: formData.challenges
            });

            if (rpcError) throw rpcError;
            router.push('/');

        } catch (error: any) {
            console.error('Onboarding error:', error);
            alert('Kurulum sırasında bir hata oluştu: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

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

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-slate-900 p-8 text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/50">
                        <Zap className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Şirketini Detaylı Tanımla</h1>
                    <p className="text-slate-400">
                        AI Danışmanlarının sana gerçekçi ve uygulanabilir tavsiyeler verebilmesi için<br />
                        şirketin hakkında detaylı bilgiye ihtiyacımız var.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    {/* Row 1: Name & Industry */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-600" /> Şirket Adı *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                placeholder="Örn: Choice Foods"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                                <Target className="w-4 h-4 text-blue-600" /> Sektör *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.industry}
                                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                placeholder="E-ticaret, SaaS, Gıda..."
                            />
                        </div>
                    </div>

                    {/* Row 2: Employee Count & Annual Revenue */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-600" /> Çalışan Sayısı *
                            </label>
                            <select
                                required
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
                            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-blue-600" /> Yıllık Ciro *
                            </label>
                            <select
                                required
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
                            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-blue-600" /> Aylık Yatırım Bütçesi
                            </label>
                            <select
                                value={formData.monthly_budget}
                                onChange={(e) => setFormData({ ...formData, monthly_budget: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                            >
                                <option value="">Seçiniz (Opsiyonel)...</option>
                                {budgetOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-600" /> Web Sitesi
                            </label>
                            <input
                                type="url"
                                value={formData.website_url}
                                onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    {/* Row 4: Target Market */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                            <Target className="w-4 h-4 text-blue-600" /> Hedef Kitle / Pazar
                        </label>
                        <input
                            type="text"
                            value={formData.target_market}
                            onChange={(e) => setFormData({ ...formData, target_market: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                            placeholder="Örn: Türkiye'deki 25-45 yaş arası profesyoneller, B2B küçük işletmeler..."
                        />
                    </div>

                    {/* Row 5: Challenges */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-500" /> Mevcut Zorluklar / Hedefler
                        </label>
                        <textarea
                            rows={3}
                            value={formData.challenges}
                            onChange={(e) => setFormData({ ...formData, challenges: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                            placeholder="Örn: Nakit akışı sıkıntımız var. Büyümek istiyoruz ama kaynak sınırlı. Dijital pazarlamada zayıfız..."
                        />
                    </div>

                    {/* Row 6: Description */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
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

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                    >
                        {loading ? 'Kurulum Yapılıyor...' : 'Kurulumu Tamamla ve Başla 🚀'}
                    </button>
                </form>
            </div>
        </div>
    );
}
