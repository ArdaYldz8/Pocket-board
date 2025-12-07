'use client';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { User } from '@supabase/supabase-js';
import { Users, Target, Lightbulb, AlertTriangle, PieChart, Heart, Gavel } from 'lucide-react';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';

const getTeamMembers = (language: string) => [
    {
        id: 'atlas',
        name: 'Atlas',
        role: language === 'tr' ? 'Stratejist' : 'Strategist',
        engRole: 'The Strategist',
        image: '/atlas.png',
        icon: <Target className="w-5 h-5 text-blue-500" />,
        description: language === 'tr'
            ? "Büyük resmi görür. Rakiplerin hamlelerini ve pazarın gidişatını analiz eder. Duygusal kararlar vermez, tamamen stratejik düşünür."
            : "Sees the big picture. Analyzes competitor moves and market trends. Makes no emotional decisions, thinks purely strategically.",
        traits: language === 'tr' ? ['Rekabetçi', 'Analitik', 'Vizyoner'] : ['Competitive', 'Analytical', 'Visionary'],
        color: 'from-blue-500 to-cyan-500'
    },
    {
        id: 'nova',
        name: 'Nova',
        role: language === 'tr' ? 'Vizyoner' : 'Visionary',
        engRole: 'The Visionary',
        image: '/nova.png',
        icon: <Lightbulb className="w-5 h-5 text-yellow-500" />,
        description: language === 'tr'
            ? "Geleceğe odaklanır. 'Neden olmasın?' sorusunu sorar. İnovasyon, marka değeri ve büyük fikirler onun alanıdır. Bütçeyi pek sevmez."
            : "Focuses on the future. Asks 'Why not?' Innovation, brand value, and big ideas are her domain. Doesn't care much about budgets.",
        traits: language === 'tr' ? ['Yaratıcı', 'Cesur', 'İnovatif'] : ['Creative', 'Bold', 'Innovative'],
        color: 'from-yellow-400 to-orange-500'
    },
    {
        id: 'marcus',
        name: 'Marcus',
        role: language === 'tr' ? 'Şüpheci' : 'Skeptic',
        engRole: 'The Skeptic',
        image: '/marcus.png',
        icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
        description: language === 'tr'
            ? "Her iddianın kanıtını ister. Olası riskleri, yasal engelleri ve planın zayıf noktalarını bulup çıkarır. İyimserliği sevmez."
            : "Demands proof for every claim. Finds potential risks, legal obstacles, and weak points in any plan. Dislikes optimism.",
        traits: language === 'tr' ? ['Sorgulayıcı', 'Tedbirli', 'Gerçekçi'] : ['Questioning', 'Cautious', 'Realistic'],
        color: 'from-red-500 to-rose-600'
    },
    {
        id: 'sterling',
        name: 'Sterling',
        role: 'CFO',
        engRole: 'The Finance Guy',
        image: '/sterling.png',
        icon: <PieChart className="w-5 h-5 text-green-500" />,
        description: language === 'tr'
            ? "Duyguları yoktur, sadece matematiği vardır. ROI, nakit akışı ve kar marjı dışındaki konularla ilgilenmez. Parayı korur."
            : "Has no emotions, only math. Cares only about ROI, cash flow, and profit margins. Protects the money.",
        traits: language === 'tr' ? ['Hesapçı', 'Disiplinli', 'Otoriter'] : ['Calculating', 'Disciplined', 'Authoritative'],
        color: 'from-emerald-500 to-green-600'
    },
    {
        id: 'maya',
        name: 'Maya',
        role: language === 'tr' ? 'Kullanıcı Dostu' : 'User Advocate',
        engRole: 'The User Advocate',
        image: '/maya.png',
        icon: <Heart className="w-5 h-5 text-pink-500" />,
        description: language === 'tr'
            ? "Şirketin kalbidir. Müşterinin ne hissedeceğini, deneyimin nasıl olacağını düşünür. Teknik detaylardan çok insana odaklanır."
            : "The heart of the company. Thinks about how customers will feel and what their experience will be. Focuses on people over technical details.",
        traits: language === 'tr' ? ['Empatik', 'Duyarlı', 'İnsan Odaklı'] : ['Empathetic', 'Sensitive', 'Human-Centered'],
        color: 'from-pink-500 to-purple-500'
    },
    {
        id: 'orion',
        name: 'Orion',
        role: language === 'tr' ? 'Moderatör' : 'Moderator',
        engRole: 'The Chairman',
        image: '/orion.png',
        icon: <Gavel className="w-5 h-5 text-slate-500" />,
        description: language === 'tr'
            ? "Toplantıyı yönetir. Tartışma kilitlendiğinde müdahale eder, konuyu değiştirir ve nihai karara varılmasını sağlar."
            : "Runs the meeting. Intervenes when discussions stall, changes topics, and ensures a final decision is reached.",
        traits: language === 'tr' ? ['Lider', 'Adil', 'Kararlı'] : ['Leader', 'Fair', 'Decisive'],
        color: 'from-slate-700 to-slate-900'
    }
];

export default function TeamPage() {
    const router = useRouter();
    const { language } = useLanguage();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const teamMembers = getTeamMembers(language);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }
            setUser(session.user);
            setLoading(false);
        };
        checkUser();
    }, [router]);

    if (loading) return null;

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
            <Sidebar user={user} />

            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                {language === 'tr' ? 'Yönetim Kurulu' : 'Board of Directors'}
                            </h1>
                            <p className="text-xs text-gray-500">
                                {language === 'tr'
                                    ? 'Kararlarınızı şekillendiren Pocket Board ekibi'
                                    : 'The Pocket Board team shaping your decisions'}
                            </p>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                        {teamMembers.map((member) => (
                            <div key={member.id} className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-1">
                                {/* Top Banner Gradient */}
                                <div className={`h-24 bg-gradient-to-r ${member.color} opacity-90 group-hover:opacity-100 transition-opacity`}></div>

                                {/* Image & Avatar */}
                                <div className="px-6 -mt-12 flex justify-between items-end">
                                    <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-md overflow-hidden bg-white">
                                        <img src={member.image} alt={member.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
                                    </div>
                                    <div className="mb-2 p-2 bg-gray-50 rounded-full border border-gray-100 shadow-sm">
                                        {member.icon}
                                    </div>
                                </div>

                                {/* Info Text */}
                                <div className="p-6 pt-4">
                                    <div className="flex flex-col mb-3">
                                        <h3 className="text-xl font-bold text-gray-900">{member.name}</h3>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-semibold text-gray-700">{member.role}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span className="text-gray-500 italic">{member.engRole}</span>
                                        </div>
                                    </div>

                                    <p className="text-sm text-gray-600 leading-relaxed mb-4 min-h-[60px]">
                                        {member.description}
                                    </p>

                                    {/* Traits Badges */}
                                    <div className="flex flex-wrap gap-2">
                                        {member.traits.map((trait, i) => (
                                            <span key={i} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-md text-xs font-medium text-gray-600">
                                                #{trait}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
