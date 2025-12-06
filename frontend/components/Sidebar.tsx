
'use client';
import { useState, useEffect } from 'react';
import { Zap, Brain, Cpu, Sparkles, Bot, MessageSquare, History, Settings, LogOut, ChevronLeft, ChevronRight, Menu, Plus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Sidebar({ user }: { user: any }) {
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [conversations, setConversations] = useState<any[]>([]);

    useEffect(() => {
        const fetchConversations = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/conversations`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                const data = await res.json();
                if (Array.isArray(data)) {
                    setConversations(data);
                }
            } catch (e) {
                console.error("Sidebar fetch error:", e);
            }
        };
        fetchConversations();
    }, []);

    const menuItems = [
        { icon: <MessageSquare className="w-5 h-5" />, label: 'Arena (Chat)', path: '/' },
        { icon: <Users className="w-5 h-5" />, label: 'Konsey Üyeleri', path: '/team' },
        { icon: <Settings className="w-5 h-5" />, label: 'Ayarlar', path: '/settings' },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
            >
                <Menu className="w-6 h-6 text-gray-700" />
            </button>

            {/* Sidebar Container */}
            <aside className={`
        fixed inset-y-0 left-0 z-40 bg-white/80 backdrop-blur-xl border-r border-gray-200 transition-all duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:relative md:translate-x-0
        ${collapsed ? 'md:w-20' : 'md:w-64'}
      `}>
                <div className="flex flex-col h-full">
                    {/* Header / Logo */}
                    <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
                        {!collapsed && (
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 relative">
                                    <img src="/logo.png" alt="Pocket Board Logo" className="w-full h-full object-contain rounded-lg shadow-sm" />
                                </div>
                                <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                                    Pocket Board
                                </span>
                            </div>
                        )}
                        {collapsed && (
                            <div className="mx-auto w-8 h-8 relative">
                                <img src="/logo.png" alt="Pocket Board Logo" className="w-full h-full object-contain rounded-lg shadow-sm" />
                            </div>
                        )}

                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="hidden md:flex p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                        >
                            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="p-4 space-y-2">
                        {menuItems.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => item.path && router.push(item.path)}
                                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                  text-gray-600 hover:bg-gray-50 hover:text-gray-900
                  ${collapsed ? 'justify-center' : ''}
                `}
                            >
                                {item.icon}
                                {!collapsed && <span>{item.label}</span>}
                            </button>
                        ))}
                    </nav>

                    {/* History List */}
                    {!collapsed && (
                        <div className="flex-1 overflow-y-auto px-4 py-2 border-t border-gray-100">
                            {/* New Chat Button */}
                            <button
                                onClick={() => {
                                    router.push('/?new=true');
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 mb-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Yeni Sohbet</span>
                            </button>

                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                Sohbetlerin
                            </h3>
                            <div className="space-y-1">
                                {conversations.length === 0 ? (
                                    <div className="text-xs text-gray-400 px-3 py-2 italic">
                                        Henüz sohbet yok.
                                    </div>
                                ) : (
                                    conversations.map((conv) => (
                                        <button
                                            key={conv.id}
                                            onClick={() => router.push(`/?id=${conv.id}`)}
                                            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg truncate transition-colors"
                                        >
                                            {conv.title || 'Yeni Tartışma'}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                    {collapsed && <div className="flex-1" />}

                    {/* User Profile */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md">
                                {user?.email?.[0].toUpperCase() || 'U'}
                            </div>
                            {!collapsed && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                        {user?.user_metadata?.full_name || 'Kullanıcı'}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                </div>
                            )}
                            {!collapsed && (
                                <button
                                    onClick={handleLogout}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Çıkış Yap"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)}
                />
            )}
        </>
    );
}
