
import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Button } from './components/Button';
import { GeminiService, ImagePart, PlaceContextResponse } from './services/geminiService';
import { DesignStyle, AspectRatio, GeneratedImage, GenerationConfig, GroundingLink } from './types';
import mammoth from 'mammoth';

const App: React.FC = () => {
  const [config, setConfig] = useState<GenerationConfig>({
    prompt: '',
    style: DesignStyle.THREE_D,
    ratio: AspectRatio.SQUARE,
    highQuality: false,
    variations: 1,
    useMaps: false
  });
  
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [downloadFormats, setDownloadFormats] = useState<Record<string, 'png' | 'jpeg' | 'webp'>>({});
  
  const [uploadedImage, setUploadedImage] = useState<ImagePart | null>(null);
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);
  const [extractedDocText, setExtractedDocText] = useState<string | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  
  const [placeContext, setPlaceContext] = useState<PlaceContextResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkKeyStatus = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      const envKey = process.env.API_KEY;
      const isKeyAvailable = selected || (!!envKey && envKey !== "undefined" && envKey !== "");
      setHasKey(isKeyAvailable);
    }
  };

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      setError(null);
    }
  };

  const getUserLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("متصفحك لا يدعم تحديد الموقع."));
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
          (err) => reject(new Error("فشل الوصول إلى الموقع الجغرافي. يرجى تفعيل الصلاحيات."))
        );
      }
    });
  };

  const processFile = async (file: File) => {
    setError(null);
    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64Data = (reader.result as string).split(',')[1];
          setUploadedImage({ data: base64Data, mimeType: file.type });
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setExtractedDocText(result.value);
        setUploadedDocName(file.name);
        setIsDocModalOpen(true);
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text();
        setExtractedDocText(text);
        setUploadedDocName(file.name);
        setIsDocModalOpen(true);
      }
    } catch (err) {
      setError('حدث خطأ في قراءة الملف المرفق.');
    }
  };

  const handleGenerate = async () => {
    const textSources = [];
    if (config.prompt.trim()) textSources.push(config.prompt.trim());
    if (extractedDocText) textSources.push(extractedDocText);
    
    const combinedPrompt = textSources.join('\n\n');
    if (!combinedPrompt && !uploadedImage) {
      setError("يرجى إدخال وصف أو صورة للبدء.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setPlaceContext(null);
    
    try {
      let extraContextText = "";
      let currentLinks: GroundingLink[] = [];

      if (config.useMaps) {
        const location = await getUserLocation();
        const context = await GeminiService.getPlaceContext(combinedPrompt || "Places around me", location);
        setPlaceContext(context);
        extraContextText = context.text;
        currentLinks = context.links;
      }

      const enhancedPrompt = await GeminiService.enhancePrompt(
        combinedPrompt || "Visual masterpiece", 
        config.style, 
        !!uploadedImage,
        extraContextText
      );
      
      const generationPromises = Array.from({ length: config.variations }).map(() => 
        GeminiService.generateImage(enhancedPrompt, config.style, config.ratio, config.highQuality, uploadedImage || undefined, Math.floor(Math.random() * 1000000))
      );

      const imageUrls = await Promise.all(generationPromises);
      const newImages: GeneratedImage[] = imageUrls.map(url => ({
        id: crypto.randomUUID(),
        url,
        prompt: (combinedPrompt || "تصميم بصري").slice(0, 100),
        timestamp: Date.now(),
        style: config.style,
        ratio: config.ratio,
        groundingLinks: currentLinks.length > 0 ? currentLinks : undefined
      }));
      
      setHistory(prev => [...newImages, ...prev]);
    } catch (err: any) {
      setError(err.message);
      if (err.message.includes("مفتاح API") || err.message.includes("تفعيل")) {
        setHasKey(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = (url: string, filename: string, format: 'png' | 'jpeg' | 'webp') => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (format === 'jpeg') { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.href = canvas.toDataURL(`image/${format}`);
      link.download = `${filename}.${format === 'jpeg' ? 'jpg' : format}`;
      link.click();
    };
    img.src = url;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-200 antialiased font-['Cairo']">
      {/* Modal for Document Text */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[2rem] shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <div>
                  <h3 className="font-black text-white">محتوى الملف المرفق</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">{uploadedDocName}</p>
                </div>
              </div>
              <button onClick={() => setIsDocModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
              {extractedDocText}
            </div>
            <div className="p-6 border-t border-slate-800 flex justify-end">
              <Button onClick={() => setIsDocModalOpen(false)} className="px-10">إغلاق</Button>
            </div>
          </div>
        </div>
      )}

      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-white tracking-tighter uppercase">CAIRO VISION AI</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {!hasKey ? (
            <button 
              onClick={handleConnectKey}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95"
            >
              <span className="w-2 h-2 bg-slate-950 rounded-full animate-pulse"></span>
              تفعيل الخدمة
            </button>
          ) : (
            <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              المحرك نشط
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <Sidebar config={config} setConfig={setConfig} />

        <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
          {!hasKey && (
            <div className="max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  </div>
                  <div className="text-right">
                    <h3 className="text-amber-500 font-black">يلزم ربط مفتاح API</h3>
                    <p className="text-xs text-amber-500/70">لاستخدام الموديلات المتقدمة، يرجى تفعيل الخدمة عبر متصفحك.</p>
                  </div>
                </div>
                <Button onClick={handleConnectKey} className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-8 font-black">
                  تفعيل الآن
                </Button>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto w-full">
            <div className={`bg-slate-900/50 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-sm transition-all duration-500 ${!hasKey ? 'opacity-40 grayscale pointer-events-none' : 'hover:border-slate-700'}`}>
              {(uploadedImage || uploadedDocName) && (
                <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-wrap gap-4 animate-in slide-in-from-top-2">
                  {uploadedImage && (
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex items-center gap-3">
                      <img src={`data:${uploadedImage.mimeType};base64,${uploadedImage.data}`} className="w-10 h-10 object-cover rounded-lg shadow-sm" alt="Reference" />
                      <button onClick={() => setUploadedImage(null)} className="text-rose-500 hover:text-rose-400 text-[10px] font-black">حذف</button>
                    </div>
                  )}
                  {uploadedDocName && (
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex items-center gap-3 group/doc">
                      <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      </div>
                      <span className="text-[10px] text-slate-300 truncate max-w-[120px] font-bold">{uploadedDocName}</span>
                      <div className="flex items-center gap-2 border-r border-slate-700 pr-3 mr-1">
                        <button onClick={() => setIsDocModalOpen(true)} className="text-blue-400 hover:text-blue-300 text-[10px] font-black transition-colors">عرض</button>
                        <button onClick={() => {setUploadedDocName(null); setExtractedDocText(null);}} className="text-rose-500 hover:text-rose-400 text-[10px] font-black transition-colors">حذف</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <textarea
                value={config.prompt}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="تخيل شيئاً مبدعاً... واكتبه هنا بلغة بسيطة"
                className="w-full bg-transparent border-none focus:ring-0 text-xl p-8 min-h-[160px] placeholder:text-slate-700 resize-none font-medium leading-relaxed"
              />

              {placeContext && (
                <div className="mx-8 mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl animate-in slide-in-from-bottom-2">
                   <div className="flex items-center gap-2 mb-2 text-emerald-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      <span className="text-[10px] font-black uppercase tracking-widest">تم تحليل الموقع بنجاح</span>
                   </div>
                   <p className="text-xs text-slate-400 mb-3 leading-relaxed italic line-clamp-2">"{placeContext.text}"</p>
                   <div className="flex flex-wrap gap-2">
                      {placeContext.links.map((link, idx) => (
                        <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                          {link.title}
                        </a>
                      ))}
                   </div>
                </div>
              )}
              
              <div className="flex items-center justify-between p-6 border-t border-slate-800 bg-slate-950/20">
                <div className="flex gap-3">
                  <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} accept="image/*,.docx,.txt" className="hidden" />
                  <Button variant="ghost" className="px-5 py-2.5 text-xs border border-slate-800 hover:border-slate-600" onClick={() => fileInputRef.current?.click()}>
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"></path></svg>
                    إرفاق وسائط
                  </Button>
                </div>
                <Button onClick={handleGenerate} loading={loading} disabled={!config.prompt.trim() && !uploadedImage && !extractedDocText} className="min-w-[160px] shadow-xl shadow-blue-600/20 font-black">
                  {loading ? 'جاري التحليل والتصميم...' : 'بدء الإبداع'}
                </Button>
              </div>
            </div>

            {error && (
              <div className="mt-6 p-4 bg-rose-950/30 border border-rose-900/50 rounded-2xl text-rose-300 text-sm flex items-start gap-4 animate-in zoom-in-95">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                   <svg className="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/></svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-rose-500 text-xs mb-1 uppercase tracking-widest">تنبيه النظام</span>
                  <span className="leading-relaxed">{error}</span>
                </div>
              </div>
            )}
          </div>

          <div className="max-w-6xl mx-auto w-full pb-20">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-300 to-slate-500">التصاميم الناتجة</h2>
              <div className="h-px flex-1 mx-8 bg-slate-800"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{history.length} عمل فني</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
              {history.map((img) => (
                <div key={img.id} className="group bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl hover:border-blue-900/40 transition-all duration-700 hover:-translate-y-2">
                  <div className="relative aspect-square bg-slate-950 overflow-hidden">
                    <img src={img.url} alt={img.prompt} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-8">
                      <div className="flex gap-2 mb-6 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">
                        {(['png', 'jpeg', 'webp'] as const).map(fmt => (
                          <button
                            key={fmt}
                            onClick={() => setDownloadFormats(p => ({...p, [img.id]: fmt}))}
                            className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition-all ${ (downloadFormats[img.id] || 'png') === fmt ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-900/80 border-slate-700 text-slate-500 hover:text-slate-300"}`}
                          >
                            {fmt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <Button onClick={() => downloadImage(img.url, `cairo-vision-${img.id}`, downloadFormats[img.id] || 'png')} className="w-full text-xs py-3 font-black translate-y-8 group-hover:translate-y-0 transition-transform duration-500 delay-75">
                        تحميل التصميم
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[9px] uppercase font-black tracking-[0.2em] text-blue-400 bg-blue-400/10 px-3 py-1.5 rounded-lg border border-blue-400/10">{img.style}</span>
                      <span className="text-[10px] font-medium text-slate-600 italic">{new Date(img.timestamp).toLocaleTimeString('ar-EG')}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 opacity-80 group-hover:opacity-100 transition-opacity">"{img.prompt}"</p>
                    
                    {img.groundingLinks && (
                      <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
                        {img.groundingLinks.map((link, idx) => (
                          <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="text-[8px] font-black bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700 hover:text-emerald-400 hover:border-emerald-500/30 transition-all truncate max-w-full">
                            {link.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {history.length === 0 && (
              <div className="flex flex-col items-center justify-center py-40 opacity-20">
                <div className="relative mb-8">
                   <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse"></div>
                   <svg className="w-20 h-20 relative text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <p className="text-lg font-black tracking-widest text-slate-500">بانتظار وصفك الأول...</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="h-10 bg-slate-950/90 backdrop-blur-md border-t border-slate-900 flex items-center justify-between px-8 text-[9px] font-black text-slate-600 tracking-widest uppercase">
        <div className="flex gap-4">
          <span>CAIRO VISION AI © 2024</span>
          <span className="text-slate-800">|</span>
          <span>POWERED BY GEMINI 2.5/3.0</span>
        </div>
        <div className="flex items-center gap-2">
           <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
           GEO-AWARE SYSTEM ACTIVE
        </div>
      </footer>
    </div>
  );
};

export default App;
