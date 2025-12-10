import random
import asyncio
import os
import re
import json
import base64
import chromadb
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
import google.generativeai as genai
from groq import Groq
from duckduckgo_search import DDGS
import requests
import requests
from bs4 import BeautifulSoup
from datetime import datetime

# Explicitly load .env from the project root (choice_foods_council/.env)
# Current file is in backend/app/services/ai_service.py
# We need to go up 3 levels: services -> app -> backend -> choice_foods_council
env_path = Path(__file__).resolve().parent.parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Import Supabase Client from auth_service
# Dual-compatible imports for local and Render deployment
try:
    from backend.app.services.auth_service import supabase, supabase_admin
except ImportError:
    try:
        from app.services.auth_service import supabase, supabase_admin
    except ImportError:
        supabase = None
        supabase_admin = None
        print("WARNING: auth_service could not be imported")

# --- HELPER FUNCTIONS ---

def perform_web_search(query):
    """Performs a web search using DuckDuckGo and returns a summary."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))
            if not results:
                return "İnternette güncel bir bilgi bulunamadı."
            
            summary = "GÜNCEL İNTERNET BİLGİLERİ:\n"
            for r in results:
                summary += f"- {r['title']}: {r['body']}\n"
            return summary
    except Exception as e:
        return f"İnternet araması yapılamadı: {str(e)}"

def scrape_website(url):
    """Scrapes the given URL for text content."""
    try:
        if not url.startswith('http'):
            url = 'https://' + url
            
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=10)
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        
        # Remove script, style, nav, footer, header elements
        for element in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            element.decompose()
            
        text = soup.get_text()
        
        # Break into lines and remove leading/trailing space on each
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text[:4000] # Increase limit for better context
    except Exception as e:
        return f"Web sitesi okunamadı: {str(e)}"

# --- VECTOR MEMORY (ChromaDB) ---
chroma_client = chromadb.Client()
collection = chroma_client.get_or_create_collection(name="debate_memory")

def save_memory_vector(topic, decision, reason):
    """Saves the final decision to Vector DB."""
    try:
        collection.add(
            documents=[f"Konu: {topic}. Karar: {decision}. Gerekçe: {reason}"],
            metadatas=[{"topic": topic, "decision": decision, "reason": reason, "date": "2025-12-05"}],
            ids=[f"{topic}_{random.randint(1000,9999)}"]
        )
    except Exception as e:
        print(f"Vector memory save error: {e}")

def search_memory_vector(query):
    """Searches past debates semantically."""
    try:
        results = collection.query(
            query_texts=[query],
            n_results=3
        )
        
        if not results['documents'][0]:
            return []
            
        memory_list = []
        for i, doc in enumerate(results['documents'][0]):
            meta = results['metadatas'][0][i]
            memory_list.append({
                "topic": meta['topic'],
                "decision": meta['decision'],
                "reason": meta['reason']
            })
        return memory_list
    except Exception:
        return []

# --- CLARIFICATION REQUEST PARSER ---
def parse_clarification(response):
    """Check if the response contains a clarification request."""
    match = re.search(r'\[CLARIFICATION:\s*(.+?)\]', response, re.IGNORECASE)
    if match:
        question = match.group(1).strip()
        # Clean the response by removing the clarification tag
        clean_response = re.sub(r'\[CLARIFICATION:\s*.+?\]', '', response, flags=re.IGNORECASE).strip()
        return {
            "has_clarification": True,
            "question": question,
            "clean_response": clean_response
        }
    return {"has_clarification": False, "question": None, "clean_response": response}

# --- VISION ANALYSIS ---
def analyze_image(image_base64, api_key=None):
    """Analyzes an image using GPT-4o-mini."""
    try:
        client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Bu görseli bir iş toplantısı bağlamında detaylıca analiz et. Ne görüyorsun? (Ofis planı, ürün, grafik vb.)"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            },
                        },
                    ],
                }
            ],
            max_tokens=300,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Görsel analiz edilemedi: {str(e)}"

class AIModel:
    def __init__(self, name, provider, model_name, persona, api_key=None):
        self.name = name
        self.provider = provider
        self.model_name = model_name
        self.persona = persona
        
        if provider == "openai":
            self.api_key = api_key or os.getenv("OPENAI_API_KEY", "").strip()
            self.base_url = None
        elif provider == "groq":
            self.api_key = api_key or os.getenv("GROQ_API_KEY", "").strip()
        elif provider == "gemini":
            self.api_key = api_key or os.getenv("GEMINI_API_KEY", "").strip()
            if self.api_key:
                genai.configure(api_key=self.api_key)
        elif provider == "anthropic":
            self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "").strip()

    def generate_response(self, messages):
        try:
            content = ""
            if self.provider == "openai":
                client = OpenAI(api_key=self.api_key)
                # GPT-5 models only support temperature=1
                temp = 1.0 if "gpt-5" in self.model_name else 0.8
                response = client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    temperature=temp
                )
                content = response.choices[0].message.content
            
            elif self.provider == "groq":
                client = Groq(api_key=self.api_key)
                response = client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    temperature=0.8
                )
                content = response.choices[0].message.content
            
            elif self.provider == "gemini":
                model = genai.GenerativeModel(self.model_name)
                # Convert OpenAI format to Gemini format (simplified)
                prompt = ""
                for msg in messages:
                    role = "User" if msg["role"] == "user" else "Model"
                    if msg["role"] == "system":
                        prompt += f"System Instruction: {msg['content']}\n\n"
                    else:
                        prompt += f"{role}: {msg['content']}\n"
                
                response = model.generate_content(prompt)
                
                # Check for valid parts (Gemini safety filter blocks content sometimes)
                if not response.parts:
                     return "Error: İçerik güvenlik filtresine takıldı veya boş döndü. (Safety Block)"
                     
                content = response.text
            
            elif self.provider == "anthropic":
                import anthropic
                client = anthropic.Anthropic(api_key=self.api_key)
                
                # Extract system message and convert to Claude format
                system_msg = ""
                user_messages = []
                for msg in messages:
                    if msg["role"] == "system":
                        system_msg = msg["content"]
                    else:
                        user_messages.append({"role": msg["role"], "content": msg["content"]})
                
                response = client.messages.create(
                    model=self.model_name,
                    max_tokens=1024,
                    system=system_msg,
                    messages=user_messages
                )
                content = response.content[0].text

            # Clean <think> blocks (common in some models like DeepSeek/Qwen)
            content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
            return content
                
        except Exception as e:
            masked_key = f"{self.api_key[:15]}..." if self.api_key else "None"
            return f"Error ({self.name}): [Key: {masked_key}] {str(e)}"

def get_debaters(company_info, language="tr"):
    c_name = company_info.get("name", "Şirket")
    c_industry = company_info.get("industry", "Genel")
    c_employees = company_info.get("employee_count", "Bilinmiyor")
    c_revenue = company_info.get("annual_revenue", "Bilinmiyor")
    c_budget = company_info.get("monthly_budget", "Bilinmiyor")
    c_target = company_info.get("target_market", "Belirtilmemiş")
    c_challenges = company_info.get("challenges", "Belirtilmemiş")
    c_description = company_info.get("description", "")
    
    # Shared context about the company
    CONTEXT = f"""
    BAĞLAM - ŞİRKET PROFİLİ:
    Şirket Adı: {c_name}
    Sektör: {c_industry}
    Çalışan Sayısı: {c_employees}
    Hedef Kitle: {c_target}
    Mevcut Zorluklar: {c_challenges}
    Açıklama: {c_description}
    
    Sen Pocket Board'un (Cebindeki Yönetim Kurulu) bir üyesisin. Rakiplerinle bu konuyu tartışacaksın.
    
    🚫 KESİNLİKLE SORU SORMA:
    - Kullanıcıya HİÇBİR KOŞULDA soru sorma.
    - Bilgi eksikse, varsayımlarla devam et veya alternatif senaryolar sun.
    - "[CLARIFICATION:" formatını KULLANMA.
    
    📝 KISA VE ÖZ OL:
    - Maksimum 2-3 cümle ile fikrini belirt.
    - Gereksiz tekrar yapma, önceki konuşmacının söylediklerini özetleme.
    - Doğrudan konuya gir, uzun giriş yapma.
    
    ÖNEMLİ:
    - Bir önceki konuşmacının verdiği RASTGELE SAYILARI gerçekmiş gibi tekrarlama.
    - Eğer kaynakta yoksa, bu sayıların "tahmini" olduğunu belirt.
    
    🌐 DİL KURALI: Kullanıcının sorusu hangi dildeyse, MUTLAKA O DİLDE cevap ver.
    """

    debaters = [
        AIModel(
            name="Atlas",
            provider="openai",
            model_name="gpt-4o-mini",
            persona="""Stratejist (The Strategist): Büyük resmi gör. Rakipler ne yapıyor? Pazar nereye gidiyor? 
            ÖNCELİKLİ KONULAR: Rekabet avantajı, pazar payı, uzun vadeli strateji.
            DÜŞÜK ÖNCELİK: Kısa vadeli maliyet detayları - stratejik bağlamda değinebilirsin.
            KONUŞMA TARZI: Soğukkanlı, analitik, 'Rakipler bize karşı ne yapar?' perspektifinden bak."""
        ),
        AIModel(
            name="Nova",
            provider="anthropic",
            model_name="claude-3-5-haiku-20241022",
            persona="""Vizyoner (The Visionary): Büyük düşün! İnovasyon, disruption ve 'Wow' faktörü senin alanın.
            ÖNCELİKLİ KONULAR: Gelecek trendler, inovasyon, marka prestiji, 'Ya büyük düşünseydik?'
            DÜŞÜK ÖNCELİK: Bütçe ve maliyet senin önceliğin değil, ama farkındaysan kısaca not edebilirsin.
            KONUŞMA TARZI: Heyecanlı, iddialı, ilham verici. 'Neden olmasın?' diye meydan oku."""
        ),
        AIModel(
            name="Marcus",
            provider="groq",
            model_name="llama-3.3-70b-versatile",
            persona="""Şüpheci (The Skeptic): Eleştirel düşün. Her iddianın kanıtını iste. Murphy Kanunları senin rehberin.
            ÖNCELİKLİ KONULAR: Riskler, belirsizlikler, 'Nereden biliyorsunuz?', 'Ya işe yaramazsa?'
            DÜŞÜK ÖNCELİK: Aşırı iyimser tahminlere karşı ol, ama yapıcı eleştiri sun.
            KONUŞMA TARZI: Sorgulayıcı ama yapıcı, 'Bu veriyi nereden çıkardın?' diye sor."""
        ),
        AIModel(
            name="Sterling",
            provider="openai",
            model_name="gpt-5-nano",
            persona="""CFO (The Finance Guy): Rakamlar ve finansal metrikler senin uzmanlık alanın.
            ÖNCELİKLİ KONULAR: ROI, nakit akışı, maliyet, geri ödeme süresi, bilanço etkisi.
            DÜŞÜK ÖNCELİK: Vizyon ve marka değeri - finansal etkisini analiz edebilirsin.
            KONUŞMA TARZI: Analitik, rakam odaklı, 'Yatırımın geri dönüşü ne olacak?' diye sor."""
        ),
        AIModel(
            name="Maya",
            provider="anthropic",
            model_name="claude-3-haiku-20240307",
            persona="""Kullanıcı Savunucusu (The User Advocate): Müşteri deneyimi senin önceliğin.
            ÖNCELİKLİ KONULAR: Müşteri deneyimi (UX), kullanıcı memnuniyeti, 'Müşteri ne hisseder?'
            DÜŞÜK ÖNCELİK: Teknik ve finansal detaylar - müşteri etkisi bağlamında değinebilirsin.
            KONUŞMA TARZI: Empatik, kullanıcı odaklı, 'Müşterinin gözünden bak' perspektifini sun."""
        )
    ]
    
    # Moderator Agent (The Chairman) - Uses the BEST model for critical oversight
    moderator = AIModel(
        name="Orion (Moderatör)",
        provider="openai",
        model_name="gpt-5-mini",
        persona="""Başkan (The Chairman): Tartışmayı yöneten ve karara varmayı sağlayan lidersin.
        GÖREVİN: Tartışma tıkandığında yeni perspektifler sun, konudan sapıldığında geri yönlendir.
        KONUŞMA TARZI: Profesyonel, kararlı ve çözüm odaklı. Tartışmayı ileriye taşı."""
    )
    
    return debaters, moderator, CONTEXT

async def simulate_debate_streaming(query, history, company_info, image_base64=None, api_key=None, conversation_id=None, language="tr", is_clarification_response=False):
    debaters, moderator, context = get_debaters(company_info, language)
    
    # Helper to save to DB asynchronously
    def save_to_db(role, content, agent_name=None):
        if conversation_id:
            try:
                msg_data = {
                    "conversation_id": conversation_id,
                    "role": role,
                    "content": content,
                    "metadata": {"agent_name": agent_name} if agent_name else {}
                }
                
                # Use Admin Client if available to bypass RLS (since backend is acting as system)
                client = supabase_admin if supabase_admin else supabase
                client.table("messages").insert(msg_data).execute()
            except Exception as e:
                print(f"DB Save Error: {e}")

    # Save User Message First
    save_to_db("user", query)

    # --- 0. VISION ANALYSIS ---
    image_description = ""
    if image_base64:
        yield {"type": "typing", "agent": "System" if language == "en" else "Sistem"}
        analyzing_vision_msg = "👁️ **Analyzing Image...**" if language == "en" else "👁️ **Görsel Analiz Ediliyor...**"
        yield {"type": "message", "role": "System" if language == "en" else "Sistem", "content": analyzing_vision_msg, "is_agent": False}
        image_description = analyze_image(image_base64, api_key)
        vision_label = "📸 **Image Analysis:**" if language == "en" else "📸 **Görsel Analizi:**"
        yield {"type": "message", "role": "System" if language == "en" else "Sistem", "content": f"{vision_label}\n{image_description}", "is_agent": False}

    
    # --- SKIP HEAVY OPERATIONS FOR CLARIFICATION RESPONSES ---
    website_content = ""
    search_results = ""
    
    if not is_clarification_response:
        # --- 0.5 WEB SEARCH & OPTION EXTRACTION ---
        yield {"type": "typing", "agent": "System" if language == "en" else "Sistem"}
        
        # NOTE: Voting options are now determined AFTER the debate ends, 
        # based on actual arguments made during discussion.
        # This prevents "tunnel vision" on open-ended questions.
    

        # --- 1. WEBSITE ANALYSIS ---
        website_url = company_info.get('website_url')
        website_content = ""
        if website_url:
            yield {"type": "typing", "agent": "System" if language == "en" else "Sistem"}
            analyzing_msg = f"🌐 **Analyzing Website:** {website_url}" if language == "en" else f"🌐 **Web Sitesi Analiz Ediliyor:** {website_url}"
            yield {"type": "message", "role": "System" if language == "en" else "Sistem", "content": analyzing_msg, "is_agent": False}
            raw_website_content = scrape_website(website_url)
        
            # Use Moderator (or first agent) to summarize the website content
            # We use a temporary prompt to the moderator model
            if language == "en":
                analysis_prompt = f"""Analyze this website and give a SHORT summary (max 5 bullet points).

    RAW TEXT:
    {raw_website_content[:2500]}

    FORMAT (use simple bullets, NO markdown symbols):
    • Company: [name - industry]
    • Business: [what they do in 1 sentence]
    • Products: [top 3-5 products]  
    • Values: [key message/slogan]
    • Target: [who they serve]

    Keep it SHORT and CLEAN. No long paragraphs."""
            else:
                analysis_prompt = f"""Bu web sitesini analiz et ve KISA bir özet ver (max 5 madde).

    HAM METİN:
    {raw_website_content[:2500]}

    FORMAT (basit maddeler kullan, markdown KULLANMA):
    • Şirket: [isim - sektör]
    • İş: [ne yaptıkları 1 cümle]
    • Ürünler: [en önemli 3-5 ürün]
    • Değerler: [ana mesaj/slogan]
    • Hedef: [kime hizmet ediyorlar]

    KISA ve TEMİZ tut. Uzun paragraflar yazma."""
        
            try:
                website_content = moderator.generate_response([{"role": "user", "content": analysis_prompt}])
            except:
                error_msg = "Could not analyze website." if language == "en" else "Site analiz edilemedi."
                website_content = error_msg

            save_to_db("system", website_content)
            yield {"type": "message", "role": "System" if language == "en" else "Sistem", "content": website_content, "is_agent": False}

        # --- 1. PERFORM WEB SEARCH ---
        yield {"type": "typing", "agent": "System" if language == "en" else "Sistem"}
    
        # Optimize Search Query
        search_optimizer = debaters[0] # Use the first agent (usually GPT-4o-mini) for optimization
        if language == "en":
            opt_prompt = [
                {"role": "system", "content": f"You are a search engine expert. TODAY'S DATE: {datetime.now().strftime('%Y-%m-%d')}. Analyze the user's discussion topic and write the BEST Google search query to find CURRENT concrete data (costs, statistics, news, trends).\n\nRULES:\n1. Write only the query, nothing else.\n2. Search in the language of the user's question and INCLUDE THE YEAR (e.g., '2025 trends')."},
                {"role": "user", "content": f"Topic: {query}\nCompany: {company_info.get('name')} ({company_info.get('industry')})"}
            ]
        else:
            opt_prompt = [
                {"role": "system", "content": f"Sen bir arama motoru uzmanısın. BUGÜNÜN TARİHİ: {datetime.now().strftime('%Y-%m-%d')}. Kullanıcının tartışma konusunu analiz et ve bu konuda GÜNCEL somut veriler (maliyet, istatistik, haber, trendler) bulmak için EN İYİ Google arama sorgusunu yaz.\n\nKURALLAR:\n1. Sadece sorguyu yaz, başka hiçbir şey yazma.\n2. Kullanıcının sorusu hangi dildeyse, aramayı O DİLDE yap ve YILI BELİRT (Örn: '2025 trends')."},
                {"role": "user", "content": f"Konu: {query}\nŞirket: {company_info.get('name')} ({company_info.get('industry')})"}
            ]
        optimized_query = search_optimizer.generate_response(opt_prompt).strip().replace('"', '')
    
        raw_search_results = perform_web_search(optimized_query)
    
        # Use Moderator to summarize the search results
        if language == "en":
            research_prompt = f"""Give a SHORT market research summary about: {query}

    SEARCH RESULTS:
    {raw_search_results[:2000]}

    FORMAT (max 4 bullet points, NO markdown, keep each point SHORT):
    • Trends: [1-2 key trends]
    • Stats: [any numbers found, or "No data"]
    • News: [1-2 recent headlines if any]
    • Recommendation: [1 sentence advice]

    Filter out irrelevant info. If no good data found, just say "No significant data found." Keep it under 100 words total."""
        else:
            research_prompt = f"""Şu konu hakkında KISA bir pazar araştırması özeti ver: {query}

    ARAMA SONUÇLARI:
    {raw_search_results[:2000]}

    FORMAT (max 4 madde, markdown KULLANMA, her madde KISA olsun):
    • Trendler: [1-2 ana trend]
    • İstatistik: [bulunan rakamlar, yoksa "Veri yok"]
    • Haberler: [varsa 1-2 güncel başlık]
    • Tavsiye: [1 cümle öneri]

    Alakasız bilgileri filtrele. İyi veri yoksa sadece "Kayda değer veri bulunamadı" de. Toplam 100 kelimeyi geçme."""
    
        try:
            search_results = moderator.generate_response([{"role": "user", "content": research_prompt}])
        except:
            error_msg = "Could not complete research." if language == "en" else "Araştırma tamamlanamadı."
            search_results = error_msg

        save_to_db("system", search_results)
        yield {"type": "message", "role": "System" if language == "en" else "Sistem", "content": search_results, "is_agent": False}
    
    # --- 2. LOAD MEMORY (VECTOR) ---
    past_decisions = search_memory_vector(query)
    memory_context = ""
    if past_decisions:
        memory_header = "PAST BOARD DECISIONS (Similar Topics):\n" if language == "en" else "GEÇMİŞ KONSEY KARARLARI (Benzer Konular):\n"
        memory_context = memory_header
        for p in past_decisions:
            if language == "en":
                memory_context += f"- Topic: {p['topic']} -> Decision: {p['decision']} ({p['reason']})\n"
            else:
                memory_context += f"- Konu: {p['topic']} -> Karar: {p['decision']} ({p['reason']})\n"
    
    # Initial setup
    messages = history + [{"role": "user", "content": query}]
    
    # Track each agent's statements for contradiction detection
    agent_history = {d.name: [] for d in debaters}
    
    # Track how many times each agent has spoken (max 2 per agent)
    agent_speak_count = {d.name: 0 for d in debaters}
    MAX_SPEAKS_PER_AGENT = 2  # Reduced from 3
    
    # Global summary of all arguments made so far to prevent repetition
    all_arguments_so_far = []
    
    # Start with random debater
    current_debater_idx = 0
    
    # Very short debates - quick to the point
    max_turns = 5  # Reduced from 8 - each agent speaks 1-2 times max
    
    for turn in range(max_turns):
        debater = debaters[current_debater_idx]
        
        # Check if this agent has reached their speaking limit
        if agent_speak_count[debater.name] >= MAX_SPEAKS_PER_AGENT:
            # Find next agent who hasn't reached limit
            found_available = False
            for i in range(len(debaters)):
                candidate_idx = (current_debater_idx + i + 1) % len(debaters)
                if agent_speak_count[debaters[candidate_idx].name] < MAX_SPEAKS_PER_AGENT:
                    current_debater_idx = candidate_idx
                    debater = debaters[current_debater_idx]
                    found_available = True
                    break
            
            # If all agents reached limit, go to voting
            if not found_available:
                break
        
        # Check if all agents have spoken at least once - can trigger early voting
        all_spoke_once = all(count >= 1 for count in agent_speak_count.values())
        if all_spoke_once and turn >= 5:  # After 5 turns, if all spoke, start voting
            break
        
        # Pick an opponent (the previous speaker, or random if first turn)
        # In a multi-agent setup, we usually address the group or the last speaker.
        # Let's find who spoke last.
        last_speaker_name = "Kullanıcı"
        if messages and messages[-1]['role'] == "assistant":
             # We need to track who sent the last message. 
             # Since 'messages' list just has 'assistant', we rely on the loop context or parse content.
             # Better: pass explicit agent name in history if possible, but for now let's assume the previous turn's agent.
             prev_idx = (current_debater_idx - 1) % len(debaters)
             last_speaker_name = debaters[prev_idx].name

        yield {"type": "typing", "agent": debater.name}
        await asyncio.sleep(1.5) # Suspense
        
        # Construct Prompt
        last_message = messages[-1]['content'] if messages else query
        
        # Summarize previous arguments
        prev_args_text = "\n".join([f"- {arg}" for arg in all_arguments_so_far])
        
        current_date_str = datetime.now().strftime("%Y-%m-%d")

        # Language instruction - MUST be at TOP of prompt for maximum effect
        lang_instruction = ""
        if language == "en":
            lang_instruction = """
        🚨 CRITICAL LANGUAGE RULE: YOU MUST RESPOND IN ENGLISH ONLY! 
        The user asked their question in English. Your entire response MUST be in English.
        Do NOT use Turkish. Do NOT mix languages. ENGLISH ONLY!
        """
        else:
            lang_instruction = """
        🚨 KRİTİK DİL KURALI: TÜRKÇE CEVAP VER!
        Kullanıcı sorusunu Türkçe sordu. Tüm cevabın Türkçe olmalı.
        """

        # System Prompt Construction
        system_prompt = f"""
        {lang_instruction}
        
        {context}
        
        TODAY'S DATE: {current_date_str}
        
        IMAGE CONTEXT: {image_description}
        WEBSITE CONTENT: {website_content}
        {search_results}
        {memory_context}
        
        PREVIOUS ARGUMENTS (DO NOT REPEAT!):
        {prev_args_text}
        
        YOU ARE: {debater.name}
        YOUR ROLE: {debater.persona}
        TOPIC: {query}
        
        RULES:
        1. Respond to the last speaker ({last_speaker_name}): {last_message}
        2. Prefer concrete data with sources [Source: X] when available.
        3. If no source, say "Based on my analysis..." or "Industry trends suggest..."
        4. Avoid making up specific numbers, but you can discuss ranges or trends.
        5. Don't repeat previous arguments.
        6. Stay in character but be flexible.
        7. Be thorough but focused (3-5 impactful sentences).
        8. Current year: {current_date_str.split('-')[0]}.
        
        OUTPUT FORMAT:
        Share your argument naturally. Optionally include [CONFIDENCE:X%] if you want to express certainty level.
        """
        
        user_msg_content = f"{last_speaker_name} said: {last_message}" if language == "en" else f"{last_speaker_name} dedi ki: {last_message}"
        
        msg_payload = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg_content}
        ]
        
        response = debater.generate_response(msg_payload)
        
        # Error Handling: Log error but continue
        if response.startswith("Error"):
            yield {"type": "message", "role": debater.name, "content": f"⚠️ {debater.name} Devre Dışı: {response}", "is_agent": True}
            messages.append({"role": "assistant", "content": f"{debater.name} teknik bir sorun nedeniyle bu turu pas geçti."})
            
            # Switch turn and continue
            current_debater_idx = (current_debater_idx + 1) % len(debaters)
            continue
        
        # Parse confidence from response (supports both Turkish and English)
        confidence = 50 # Default confidence
        clean_response = response
        
        confidence_match = re.search(r'\[(GÜVEN|CONFIDENCE):?\s*(\d+)%\]', response, re.IGNORECASE)
        if confidence_match:
            confidence = int(confidence_match.group(2))
            clean_response = re.sub(r'\[(GÜVEN|CONFIDENCE):?\s*\d+%\]\s*', '', response, flags=re.IGNORECASE).strip()
        
        # NOTE: Clarification feature disabled - agents no longer ask questions
        
        yield {"type": "message", "role": debater.name, "content": clean_response, "is_agent": True, "confidence": confidence}
        save_to_db("assistant", clean_response, agent_name=debater.name)
        
        messages.append({"role": "assistant", "content": clean_response})
        
        # Increment agent speak count
        agent_speak_count[debater.name] += 1
        
        
        # --- CONTRADICTION DETECTION ---
        if len(agent_history[debater.name]) >= 1:
            # Check for contradictions with previous statements
            prev_statements = " | ".join(agent_history[debater.name][-3:])  # Last 3 statements
            
            contradiction_prompt = f"""
            GÖREV: Aşağıdaki iki metni karşılaştır ve çelişki var mı kontrol et.
            
            ÖNCEKİ SÖZLER ({debater.name}):
            {prev_statements}
            
            YENİ SÖZ:
            {clean_response}
            
            SORU: Bu yeni söz, önceki sözlerle TEMEL BİR ÇELİŞKİ (A vs A değil) içeriyor mu?
            
            DİKKAT:
            - Eğer ajan "Yeni veriye dayanarak fikrimi değiştirdim" diyorsa bu ÇELİŞKİ DEĞİLDİR, stratejik bir manevradır.
            - Eğer ajan "Risk var ama fırsat da var" diyorsa bu ÇELİŞKİ DEĞİLDİR, bir ikilemdir.
            - Sadece bariz tutarsızlıkları (Örn: "Paramız yok" deyip sonra "Bütçemiz bol" demek) bildir.
            
            CEVAP FORMATI (SADECE BİRİ):
            - EĞER TEMEL ÇELİŞKİ VARSA: "ÇELİŞKİ: [kısa açıklama]"
            - EĞER YOKSA: "YOK"
            """
            
            try:
                check_result = moderator.generate_response([{"role": "user", "content": contradiction_prompt}])
                
                if check_result.startswith("ÇELİŞKİ:"):
                    contradiction_msg = check_result.replace("ÇELİŞKİ:", "").strip()
                    contradiction_text = f"🔍 **Çelişki Tespit Edildi!** {debater.name}: {contradiction_msg}"
                    save_to_db("system", contradiction_text)
                    yield {"type": "message", "role": "Sistem", "content": contradiction_text, "is_agent": False}
            except:
                pass  # Silent fail
        
        # Add current statement to history
        agent_history[debater.name].append(clean_response)
        
        # Extract core argument (1 sentence summary) to prevent prompt bloat
        try:
            summary_prompt = f"Bu argümanı TEK CÜMLE ile özetle (sadece ana fikir): {clean_response[:200]}"
            core_arg = moderator.generate_response([{"role": "user", "content": summary_prompt}])
            all_arguments_so_far.append(f"{debater.name}: {core_arg[:100]}")
        except:
            all_arguments_so_far.append(f"{debater.name}: {clean_response[:80]}...")
        
        
        # --- MODERATOR INTERVENTION (Every 3 turns) ---
        if (turn + 1) % 3 == 0 and turn < max_turns - 1:
            yield {"type": "typing", "agent": moderator.name}
            await asyncio.sleep(1)
            
            # Build context for moderator
            recent_messages = messages[-6:] if len(messages) >= 6 else messages
            recent_summary = "\n".join([f"- {m['content'][:100]}..." for m in recent_messages])
            
            mod_prompt = f"""
            SEN: {moderator.name} ({moderator.persona})
            ANA KONU: {query}
            ŞİRKET: {company_info.get('name')} ({company_info.get('industry')})
            
            SON KONUŞMALAR:
            {recent_summary}
            
            GÖREVİN:
            1. Tartışmayı KARARA götürmek.
            2. Tartışma tıkandıysa: Yeni bir perspektif sun veya farklı bir açıdan düşünmeye davet et.
            3. Konudan sapıldıysa: Nazikçe ama kararlı bir şekilde ANA KONUYA ({query}) geri yönlendir.
            4. Konuyla alakasız öneriler sunma.
            
            ÜSLUBUN: 
            - Profesyonel, kararlı ve çözüm odaklı.
            - Tartışmayı ileriye taşı, taraflar arasında köprü kur.
            - Saygılı ama otoriter ol.
            
            FORMAT: 3-4 cümle ile özetle ve yönlendir.
            """
            
            mod_response = moderator.generate_response([{"role": "user", "content": mod_prompt}])
            
            if not mod_response.startswith("Error"):
                mod_msg = f"⚖️ {mod_response}"
                save_to_db("assistant", mod_response, agent_name=moderator.name)
                yield {"type": "message", "role": moderator.name, "content": mod_msg, "is_agent": True}
                messages.append({"role": "assistant", "content": f"[Moderatör]: {mod_response}"})
        
        # Smart Turn Taking Logic
        # 1. Check if specific agent was mentioned in the last response
        next_idx = -1
        for i, d in enumerate(debaters):
            if i != current_debater_idx and d.name in response:
                next_idx = i
                break
        
        # 2. If no direct mention, pick random opponent (Chaos Mode)
        if next_idx == -1:
            candidates = [i for i in range(len(debaters)) if i != current_debater_idx]
            next_idx = random.choice(candidates)
            
        current_debater_idx = next_idx
    
    # --- VOTING ROUND (always runs after debate ends) ---
    # --- VOTING ROUND ---
    yield {"type": "typing", "agent": "Sistem"}
    await asyncio.sleep(1)
    yield {"type": "message", "role": "Sistem", "content": "🏁 Tartışma Sona Erdi. Seçenekler Belirleniyor...", "is_agent": False}
            
    # --- EXTRACT VOTING OPTIONS FROM DEBATE ---
    # Summarize all arguments to create meaningful options
    debate_summary = "\n".join([m['content'] for m in messages[-10:] if m.get('role') == 'assistant'])
    
    option_extract_prompt = f"""
    GÖREV: Aşağıdaki tartışmayı analiz et ve OY VERİLEBİLECEK somut seçenekler çıkar.
    
    KONU: {query}
    
    TARTIŞMA ÖZETİ:
    {debate_summary[:2000]}
    
    KURALLAR:
    1. Tartışmada öne çıkan FARKLI görüşleri/önerileri seçenek olarak belirle.
    2. Eğer tartışmada somut rakamlar verilmişse (Örn: "700 USD", "2000 USD"), bunları seçeneklere dahil et.
    3. Eğer karar Evet/Hayır'a indirgenebiliyorsa, sadece 2 seçenek yaz.
    4. Açık uçlu sorularda, tartışmada ortaya çıkan farklı stratejileri/yaklaşımları listele.
    5. Maksimum 4, minimum 2 seçenek olsun.
    6. Çıktı SADECE JSON formatında bir liste olsun: ["Seçenek 1", "Seçenek 2", ...]
    
    ÖNEMLİ: Seçenekler TARTIŞMADAN çıkmalı, uydurma olmamalı.
    """
    
    try:
        opt_response = moderator.generate_response([{"role": "user", "content": option_extract_prompt}])
        voting_options = json.loads(opt_response.replace("```json", "").replace("```", "").strip())
        
        # Validate
        if not isinstance(voting_options, list) or len(voting_options) < 2:
            voting_options = ["KABUL", "RED"]
    except:
        voting_options = ["KABUL", "RED"]

    voting_options_str = ", ".join(voting_options)
    system_msg_content = f"🎯 **Oylama Seçenekleri:** {voting_options_str}"
    save_to_db("system", system_msg_content)
    yield {"type": "message", "role": "Sistem", "content": system_msg_content, "is_agent": False}
    
    votes = []
    
    for d in debaters:
        vote_prompt = f"""
        {context}
        KONU: {query}
        TARTIŞMA GEÇMİŞİ: {messages[-5:]}
        
        MEVCUT SEÇENEKLER: {voting_options_str}
        
        SEN: {d.name} ({d.persona})
        
        GÖREVİN:
        Bu konuyu oyla. SADECE yukarıdaki seçeneklerden birini seç.
        Seçeneği TAM OLARAK VE HARFİ HARFİNE kopyala. ("YAP" yerine "YAP (Satın Al)" yaz).
        
        Çıktı formatı SADECE JSON olmalı:
        {{"decision": "TAM_SEÇENEK_İSMİ", "reason": "Tek cümlelik kısa gerekçe"}}
        """
        
        # Retry logic for JSON
        max_retries = 2
        vote_data = {"decision": "ÇEKİMSER", "reason": "Oylama hatası."}
        
        for attempt in range(max_retries):
            try:
                vote_response = d.generate_response([{"role": "user", "content": vote_prompt}])
                # Clean json markdown if present
                vote_response = vote_response.replace("```json", "").replace("```", "").strip()
                vote_data = json.loads(vote_response)
                
                break 
            except:
                if attempt == max_retries - 1:
                    print(f"Voting failed for {d.name} after retries.")
                continue

        decision = vote_data.get("decision", "ÇEKİMSER").upper()
        
        # NORMALIZE VOTE: Fuzzy match to nearest option (Best Score)
        # This fixes "YAP" vs "YAP (Satın Al)" and prevents "YAPMA" -> "YAP" overlap errors
        import difflib
        
        best_match = decision
        highest_ratio = 0.0
        
        for optic in voting_options:
            # Calculate similarity ratio
            ratio = difflib.SequenceMatcher(None, decision, optic.upper()).ratio()
            
            # Bonus for substring match (e.g. "YAP" inside "YAP (Satın Al)")
            if decision in optic.upper():
                ratio += 0.2
            
            if ratio > highest_ratio:
                highest_ratio = ratio
                best_match = optic
        
        # Threshold to accept match (e.g. 0.4)
        if highest_ratio > 0.4:
            final_decision = best_match
        else:
            final_decision = decision # Keep original if NO match found
        
        votes.append({
            "agent": d.name,
            "persona": d.persona.split(":")[0],
            "decision": final_decision,
            "reason": vote_data.get("reason", "...")
        })
    
    # Determine Final Result
    vote_counts = {}
    for v in votes:
        decision = v['decision']
        vote_counts[decision] = vote_counts.get(decision, 0) + 1
    
    final_decision = max(vote_counts, key=vote_counts.get) if votes else "ÇEKİMSER"

    # --- 3. SAVE MEMORY (VECTOR) ---
    save_memory_vector(query, final_decision, f"Votes: {json.dumps(vote_counts, ensure_ascii=False)}")
    
    save_to_db("vote_results", json.dumps(votes, ensure_ascii=False))
    yield {"type": "vote_results", "votes": votes}
    # --- END OF DEBATE: DECISION REPORT ---
    yield {"type": "typing", "agent": "Sistem"}
    yield {"type": "message", "role": "Sistem", "content": "📋 **Nihai Karar Raporu Hazırlanıyor...**", "is_agent": False}
    
    full_history_text = "\n".join([f"{m['role']}: {m['content']}" for m in messages if m['role'] != "system"])
    
    report_prompt = f"""
    GÖREV: Bu yönetim kurulu toplantısının "Nihai Karar Tutanağı"nı hazırla.
    
    TARTIŞMA GEÇMİŞİ:
    {full_history_text}
    
    TALİMATLAR:
    - Profesyonel, resmi ve net bir dil kullan.
    - Markdown formatını kusursuz uygula (Başlıklar, Listeler, Kalın Yazı).
    - Her ana başlık öncesinde ve sonrasında MUTLAKA bir boş satır bırak.
    
    ÇIKTI FORMATI (TAM OLARAK BU ŞABLONU KULLAN):
    
    # 📋 [Konu Başlığı] - Karar Raporu
    
    ## 1. Yönetici Özeti
    (Buraya 2-3 cümlelik net bir özet gelecek. Ne konuşuldu, hangi engeller çıktı, sonuç ne oldu?)
    
    ## 2. Temel Bulgular (SWOT Analizi)
    ### ✅ Fırsatlar & Artılar
    - (Madde 1)
    - (Madde 2)
    
    ### ⚠️ Riskler & Tehditler
    - (Madde 1)
    - (Madde 2)
    
    ## 3. Nihai Karar
    **(Karar: ONAY / RED / ERTELEME / REVİZYON)**
    (Kararın gerekçesini buraya yaz.)
    
    ## 4. Aksiyon Planı
    1. **[Hemen]:** (İlk adım)
    2. **[Orta Vade]:** (Sonraki adım)
    3. **[Kritik Uyarı]:** (Varsa dikkat edilmesi gereken nokta)
    
    ---
    *Rapor Tarihi: {current_date_str} | Raportör: Pocket Board AI*
    """
    
    try:
        report_content = moderator.generate_response([{"role": "user", "content": report_prompt}])
        yield {"type": "message", "role": "Sistem", "content": report_content, "is_agent": False}
        save_to_db("system", report_content)
    except Exception as e:
        yield {"type": "message", "role": "Sistem", "content": f"Rapor oluşturulamadı: {str(e)}", "is_agent": False}

    yield {"type": "end", "reason": "max_turns"}
