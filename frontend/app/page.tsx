
'use client';

import { useState, useEffect, Suspense } from 'react';
import { Send, Bot, User, Sparkles, Zap, Brain, Cpu, Paperclip, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: string;
  content: string;
  agentName?: string;
  isTyping?: boolean;
  confidence?: number;
}

interface Vote {
  agent: string;
  persona: string;
  decision: string;
  reason: string;
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Konsey Hazırlanıyor...</p>
        </div>
      </div>
    }>
      <BoardContent />
    </Suspense>
  );
}

function BoardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationIdParam = searchParams.get('id');
  const isNewChat = searchParams.get('new') === 'true';

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Auth & Org Check
  useEffect(() => {
    const checkUserAndOrg = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);

      // Fetch Profile & Linked Org
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', session.user.id)
        .single();

      if (profile?.organization_id) {
        // Fetch Org Details
        const { data: org } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .single();

        if (org) {
          setCompanyInfo({
            name: org.name,
            businessModel: org.industry || '',
            currentGoal: org.description || '',
            websiteUrl: org.website_url || '',
            // others can be empty or derived
            officeType: '',
            budgetStatus: '',
            culture: '',
            challenges: ''
          });
          setShowModal(false); // Skip modal

          // Only add context loading Msg if no history loaded yet
          // Actually, we'll let history load handle messages.
          // setMessages(prev => [...prev, {
          //   role: 'system',
          //   content: `Bağlam Yüklendi: ${org.name} (${org.industry})`
          // }]);

          setLoading(false);
          return;
        }
      }

      // If no org found, redirect to Onboarding
      // But allow a short loading state or check if we are on onboarding page (not needed here as this is Home)
      // Only redirect if we are SURE they have no org and are logged in.
      // For now, let's redirect.
      router.push('/onboarding');
      setLoading(false);
    };

    checkUserAndOrg();
  }, [router]);

  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'Pocket Board\'a Hoş Geldiniz. Konuyu belirleyin, yönetim kurulunun tartışmasını izleyin.' }
  ]);
  const [votes, setVotes] = useState<Vote[] | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [showModal, setShowModal] = useState(true);
  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    officeType: '',
    budgetStatus: '',
    businessModel: '',
    currentGoal: '',
    culture: '',
    challenges: '',
    websiteUrl: ''
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>('Hazır');

  // Pre-Debate Context Expansion
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [contextDetails, setContextDetails] = useState({
    budget: '',
    timeline: '',
    constraints: ''
  });

  // Fetch History on Load or ID Change
  useEffect(() => {
    // Skip history load if starting a new chat
    if (isNewChat) {
      setMessages([{ role: 'system', content: 'Pocket Board\'a Hoş Geldiniz. Konuyu belirleyin, yönetim kurulunun tartışmasını izleyin.' }]);
      setConversationId(null);
      setVotes(null);
      return;
    }

    const fetchHistory = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      try {
        let url = `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/history`;
        if (conversationIdParam) {
          url += `?conversation_id=${conversationIdParam}`;
        }

        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();

        if (data.messages && data.messages.length > 0) {
          // Replace initial welcome message with actual history if exists
          setMessages(data.messages);
          setConversationId(data.conversation_id);

          // Extract vote_results from messages to populate votes panel
          const voteResultsMsg = data.messages.find((m: any) => m.type === 'vote_results');
          if (voteResultsMsg && voteResultsMsg.votes) {
            setVotes(voteResultsMsg.votes);
          }
        } else if (data.messages && data.messages.length === 0 && conversationIdParam) {
          // If new conversation (no messages yet), reset messages
          setMessages([{ role: 'system', content: 'Yeni Tartışma Başlatıldı.' }]);
          setConversationId(conversationIdParam);
        }
      } catch (err) {
        console.error('History fetch failed:', err);
      }
    };

    fetchHistory();
  }, [conversationIdParam, isNewChat]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Content = base64String.split(',')[1];
        setSelectedImage(base64Content);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (companyInfo.name && companyInfo.businessModel) {
      setShowModal(false);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Bağlam Ayarlandı: ${companyInfo.name}.`
      }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Build enhanced message with context details if provided
    let enhancedInput = input;
    const contextParts = [];
    if (contextDetails.budget) contextParts.push(`Bütçe: ${contextDetails.budget}`);
    if (contextDetails.timeline) contextParts.push(`Süre: ${contextDetails.timeline}`);
    if (contextDetails.constraints) contextParts.push(`Kısıtlar: ${contextDetails.constraints}`);

    if (contextParts.length > 0) {
      enhancedInput = `${input}\n\n[EK BAĞLAM: ${contextParts.join(' | ')}]`;
    }

    const userMsg = { role: 'user', content: enhancedInput };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setVotes(null); // Reset votes

    // Reset context panel after sending
    setContextDetails({ budget: '', timeline: '', constraints: '' });
    setShowContextPanel(false);

    // Optimistic Update
    setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true, agentName: 'Sistem' }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        alert('Oturum süreniz dolmuş olabilir.');
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMsg.content,
          company_info: {
            name: companyInfo.name,
            industry: companyInfo.businessModel,
            description: companyInfo.currentGoal,
            website_url: companyInfo.websiteUrl
          },
          image: selectedImage,
          conversation_id: conversationId
        }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Remove typing indicator before stream starts
      setMessages(prev => prev.filter(m => !m.isTyping));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'message') {
                setMessages((prev) => [...prev, {
                  role: data.role,
                  content: data.content,
                  agentName: data.role === 'assistant' ? data.agentName : data.role,
                  confidence: data.confidence
                }]);
              } else if (data.type === 'meta') {
                setConversationId(data.conversation_id);
              } else if (data.type === 'typing') {
                // Enhance: Show specific agent typing if needed
              } else if (data.type === 'vote_results') {
                setVotes(data.votes);
              } else if (data.type === 'phase') {
                setCurrentPhase(data.phase);
              } else if (data.error) {
                setMessages(prev => [...prev, { role: 'system', content: `Error: ${data.error}` }]);
                setIsLoading(false);
              } else if (data.type === 'end') {
                setIsLoading(false);
              }
            } catch (e) {
              console.error('JSON Parse Error', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setIsLoading(false);
    }
  };

  const getAgentStyle = (name: string | undefined) => {
    if (!name) return { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: <Bot className="w-5 h-5 text-indigo-600" /> };
    if (name.includes('CEO') || name.includes('Lider')) return { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <Zap className="w-5 h-5 text-emerald-600" /> };
    if (name.includes('CTO') || name.includes('Vizyoner')) return { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Brain className="w-5 h-5 text-blue-600" /> };
    if (name.includes('Product') || name.includes('Kullanıcı')) return { bg: 'bg-rose-100', text: 'text-rose-700', icon: <User className="w-5 h-5 text-rose-600" /> };
    if (name.includes('Mühendis') || name.includes('Teknik')) return { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Cpu className="w-5 h-5 text-amber-600" /> };
    if (name.includes('Pazarlamacı') || name.includes('Hype')) return { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Sparkles className="w-5 h-5 text-purple-600" /> };
    return { bg: 'bg-slate-100', text: 'text-slate-700', icon: <Bot className="w-5 h-5 text-slate-600" /> };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <Sidebar user={user} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">

        {/* Onboarding Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full transform transition-all scale-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-blue-600" />
                  Konseyi Topla
                </h2>
                {/* Optional close button if needed */}
              </div>

              <form onSubmit={handleModalSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Şirket/Proje Adı</label>
                  <input
                    type="text"
                    required
                    value={companyInfo.name}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Örn: Trendyol, SpaceX, Mahalle Bakkalı..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Web Sitesi (Opsiyonel)</label>
                  <input
                    type="url"
                    value={companyInfo.websiteUrl}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, websiteUrl: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-slate-500 mt-1">Sitenizi analiz edip bağlama ekleyeceğiz.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Hangi Sektör?</label>
                  <input
                    type="text"
                    required
                    value={companyInfo.businessModel}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, businessModel: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="E-ticaret, SaaS, Lojistik..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all"
                >
                  Konseyi Başlat 🚀
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Dashboard Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              {companyInfo.name || 'AI Arena Paneli'}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {companyInfo.businessModel ? `${companyInfo.businessModel} • Aktif Oturum` : 'Bağlam Bekleniyor'}
            </p>
          </div>
          {/* Right Header Actions if needed */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Online
            </span>
          </div>
        </header>

        {/* Phase Indicator */}
        {currentPhase && currentPhase !== 'Hazır' && (
          <div className="bg-white/95 backdrop-blur-sm border-b border-indigo-100 px-6 py-3 sticky top-16 z-20 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3 w-full max-w-2xl mx-auto">
              <div className={`p-2 rounded-lg shrink-0 ${currentPhase.includes('AŞAMA 1') ? 'bg-blue-100 text-blue-600' : currentPhase.includes('AŞAMA 2') ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                {currentPhase.includes('AŞAMA 1') && <Brain className="w-5 h-5" />}
                {currentPhase.includes('AŞAMA 2') && <Zap className="w-5 h-5" />}
                {currentPhase.includes('AŞAMA 3') && <Sparkles className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-sm font-bold text-slate-800">{currentPhase}</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {currentPhase.includes('AŞAMA 1') ? 'Veri Odaklı' : currentPhase.includes('AŞAMA 2') ? 'Çatışma Odaklı' : 'Çözüm Odaklı'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ease-out rounded-full shadow-sm ${currentPhase.includes('AŞAMA 1') ? 'w-1/3 bg-blue-500' :
                    currentPhase.includes('AŞAMA 2') ? 'w-2/3 bg-orange-500' :
                      'w-full bg-green-500'
                    }`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
          {messages.map((msg, idx) => {
            const style = getAgentStyle(msg.agentName);
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system' || !msg.role; // Fallback

            // Avatar Helper
            const getAvatar = (name: string | undefined) => {
              if (!name) return null;
              const n = name.toLowerCase();
              if (n.includes('atlas')) return '/atlas.png';
              if (n.includes('nova')) return '/nova.png';
              if (n.includes('marcus')) return '/marcus.png';
              if (n.includes('sterling')) return '/sterling.png';
              if (n.includes('maya')) return '/maya.png';
              if (n.includes('orion') || n.includes('moderatör')) return '/orion.png';
              return null;
            };

            const agentImage = getAvatar(msg.agentName);

            if (isSystem && !msg.agentName) {
              const content = msg.content || ''; // Fallback for safety
              const isLongMessage = content.length > 200 || content.includes('#');

              if (isLongMessage) {
                return (
                  <div key={idx} className="flex justify-center my-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-3xl w-full prose prose-slate prose-sm md:prose-base">
                      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                        <span className="text-2xl">📋</span>
                        <span className="font-bold text-slate-800">Sistem Raporu</span>
                      </div>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                )
              }

              // System Notification Style (Short)
              return (
                <div key={idx} className="flex justify-center my-4">
                  <span className="px-4 py-2 bg-slate-200/50 text-slate-600 text-xs font-semibold rounded-full border border-slate-200 backdrop-blur-sm shadow-sm">
                    {msg.content}
                  </span>
                </div>
              )
            }

            // Question Detection
            const isQuestion = msg.content.includes('[SORU:');
            const questionStyle = isQuestion ? "border-amber-300 bg-amber-50 shadow-md ring-2 ring-amber-100" : "";

            return (
              <div key={idx} className={`flex gap-4 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                {/* Avatar */}
                <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-105 overflow-hidden
                    ${isUser ? 'bg-slate-900 text-white' : (agentImage ? 'bg-transparent' : style.bg)}
                `}>
                  {isUser ? <User className="w-5 h-5" /> : (
                    agentImage ? <img src={agentImage} alt={msg.agentName} className="w-full h-full object-cover" /> : style.icon
                  )}
                </div>

                {/* Bubble */}
                <div className={`
                    flex-1 p-5 rounded-2xl shadow-sm border
                    ${isUser
                    ? 'bg-slate-900 text-white border-slate-800 rounded-tr-sm'
                    : `bg-white text-slate-700 border-slate-100 rounded-tl-sm hover:shadow-md transition-shadow ${questionStyle}`}
                `}>
                  {!isUser && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-50">
                      <span className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>{msg.agentName}</span>
                      {isQuestion && (
                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-800 animate-pulse">SIZA SORDU</span>
                      )}
                      {msg.confidence !== undefined && (
                        <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-500`}>
                          %{msg.confidence} Güven
                        </span>
                      )}
                    </div>
                  )}

                  <div className={`prose prose-sm leading-relaxed ${isUser ? 'prose-invert' : 'text-slate-600'}`}>
                    {msg.content}
                  </div>

                  {/* Confidence Bar (Visual) */}
                  {msg.confidence !== undefined && !isUser && (
                    <div className="mt-3 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${msg.confidence >= 80 ? 'bg-emerald-500' : msg.confidence >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${msg.confidence}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Render Votes if available */}
          {votes && (
            <div className="max-w-3xl mx-auto mt-8 relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-200 via-orange-200 to-yellow-200 rounded-3xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative bg-white/90 backdrop-blur-xl border border-amber-100 rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Konsey Nihai Kararı
                  </h3>
                </div>

                {/* Summary Bar */}
                <div className="p-6 border-b border-slate-100">
                  <div className="flex flex-wrap gap-3">
                    {Array.from(new Set(votes.map(v => v.decision))).map(decision => {
                      const count = votes.filter(v => v.decision === decision).length;
                      const total = votes.length;
                      const percentage = Math.round((count / total) * 100);

                      // Color mapping
                      let bgClass = "bg-slate-500";
                      if (decision.includes('KABUL') || decision.includes('EVET')) bgClass = "bg-emerald-500";
                      else if (decision.includes('RED') || decision.includes('HAYIR')) bgClass = "bg-rose-500";
                      else bgClass = "bg-indigo-500"; // Default for custom options

                      return (
                        <div key={decision} className="flex-1 min-w-[120px] bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
                          <div className={`absolute top-0 left-0 h-1 w-full ${bgClass}`}></div>
                          <span className="text-2xl font-black text-slate-800">{count}</span>
                          <span className="text-xs font-bold text-slate-500 text-center uppercase mt-1">{decision}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Detailed Votes */}
                <div className="p-6 grid gap-4 bg-slate-50/50">
                  {votes.map((vote, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                        {vote.agent[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{vote.agent}</span>
                          <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{vote.persona}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 italic">"{vote.reason}"</p>
                      </div>
                      <div className="ml-auto">
                        <span className="text-xs font-bold px-2 py-1 bg-slate-900 text-white rounded">
                          {vote.decision}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100 text-sm text-slate-500 animate-pulse">
                <Bot className="w-4 h-4" />
                Konsey üyeleri düşünüyor...
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/80 backdrop-blur-lg border-t border-slate-200">
          {/* Context Expansion Panel */}
          {showContextPanel && (
            <div className="max-w-3xl mx-auto mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-bold text-slate-700">📊 Tartışma Bağlamı (Opsiyonel)</h4>
                <button
                  type="button"
                  onClick={() => setShowContextPanel(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Kapat
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">💰 Bütçe Tahmini</label>
                  <input
                    type="text"
                    value={contextDetails.budget}
                    onChange={(e) => setContextDetails({ ...contextDetails, budget: e.target.value })}
                    placeholder="Örn: Max 50.000 TL"
                    className="w-full p-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">⏱️ Zaman Çizelgesi</label>
                  <input
                    type="text"
                    value={contextDetails.timeline}
                    onChange={(e) => setContextDetails({ ...contextDetails, timeline: e.target.value })}
                    placeholder="Örn: 3 ay içinde"
                    className="w-full p-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">⚠️ Kısıtlamalar</label>
                  <input
                    type="text"
                    value={contextDetails.constraints}
                    onChange={(e) => setContextDetails({ ...contextDetails, constraints: e.target.value })}
                    placeholder="Örn: Ek personel alamayız"
                    className="w-full p-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none"></div>
            <div className="relative z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowContextPanel(!showContextPanel)}
                className={`p-3 rounded-xl border transition-all ${showContextPanel ? 'bg-blue-100 border-blue-300 text-blue-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
                title="Detay Ekle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Konseyinize danışın..."
                className="flex-1 pl-4 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-900 placeholder:text-slate-400 font-medium transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-3 bg-slate-900 text-white rounded-xl hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
          <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">
            AI Arena &bull; Powered by Deepmind & Gemini &bull; v2.0 Professional
          </p>
        </div>
      </main>
    </div>
  );
}
