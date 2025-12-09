# Choice Foods Council

AI destekli yönetim kurulu simülasyonu - Şirket kararlarını sanal danışmanlarla tartışın ve analiz edin.

## 🏗️ Proje Yapısı

```
choice_foods_council/
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── api/      # API endpoints
│   │   └── services/ # AI ve auth servisleri
│   └── requirements.txt
├── frontend/         # Next.js frontend
│   ├── app/          # Sayfalar
│   ├── components/   # React bileşenleri
│   ├── lib/          # Yardımcı fonksiyonlar
│   └── locales/      # Çoklu dil desteği (TR/EN)
├── scripts/          # Geliştirici araçları
│   ├── check_env.py  # Environment kontrol
│   └── test_keys.py  # API key testi
└── migrations/       # Veritabanı migrations
```

## 🚀 Kurulum

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🔧 Çevre Değişkenleri

Root dizininde `.env` dosyası oluşturun:

```env
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📜 Scriptler

```bash
# Environment değişkenlerini kontrol et
python scripts/check_env.py

# API keylerini test et
python scripts/test_keys.py

# Mevcut modelleri listele
python scripts/list_models.py
python scripts/list_groq_models.py
```

## 🌐 Deploy

Render üzerinde deploy için `render.yaml` dosyası yapılandırılmıştır.
