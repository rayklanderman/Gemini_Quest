import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, Mic, Image as ImageIcon, Send, Moon, Sun, 
  Share2, ChevronRight, Trophy, Flame, Menu, X, RefreshCw, PlayCircle, StopCircle, Video, Activity,
  PenTool, Eye, Accessibility, Download, Sparkles, Smile, Radio, Edit, Globe, MapPin, MessageCircle, ArrowRight, XCircle, Search, Music, Zap, Mic2
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { 
    analyzeQuestInputs, generateExplainerVideo, generateNarration, checkApiKey, selectApiKey, detectUserEmotion, 
    editImageWithNano, fetchRealTimeData, fetchMapData, chatWithAgent 
} from './services/geminiService';
import { QuestResult, QuestSession, UserProfile, QuizQuestion, AccessibilitySettings } from './types';
import { INITIAL_PROFILE, LEVELS } from './constants';

declare global {
  interface Window {
    confetti: any;
  }
}

// --- VISUALIZER COMPONENT (Intro) ---
const ConstellationVisualizer: React.FC<{ onSkip: () => void }> = ({ onSkip }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        
        const particles: {x: number, y: number, vx: number, vy: number, size: number}[] = [];
        const particleCount = Math.min(100, (width * height) / 9000); 

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 242, 255, ${0.5 + Math.random() * 0.5})`; 
                ctx.fill();
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(189, 0, 255, ${1 - dist / 150})`; 
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            });
            requestAnimationFrame(animate);
        };
        const animId = requestAnimationFrame(animate);
        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);
        const t1 = setTimeout(() => setOpacity(0), 4500); 
        const t2 = setTimeout(onSkip, 5500); 
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [onSkip]);

    return (
        <div className="fixed inset-0 z-[100] bg-void-900 flex flex-col items-center justify-center transition-opacity duration-1000" style={{ opacity }}>
            <canvas ref={canvasRef} className="absolute inset-0" />
            <div className="z-10 text-center animate-slide-up px-4">
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-2 drop-shadow-[0_0_15px_rgba(0,242,255,0.5)]">
                    GeminiQuest
                </h1>
                <p className="text-neon-cyan text-xl tracking-widest uppercase font-light">Ignite Curiosity</p>
            </div>
            <button onClick={onSkip} aria-label="Skip Intro" className="absolute bottom-10 z-20 text-white/40 hover:text-white border border-white/10 px-6 py-2 rounded-full text-sm uppercase tracking-wider hover:bg-white/5 transition-all">
                Skip Intro
            </button>
        </div>
    );
};

// --- EASTER EGG COMPONENT ---
const TrailerOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center animate-fade-in">
        <button onClick={onClose} aria-label="Close Trailer" className="absolute top-8 right-8 text-white/50 hover:text-white z-50 p-2 bg-white/10 rounded-full backdrop-blur-md"><X size={32}/></button>
        <div className="w-full max-w-5xl aspect-video relative p-4">
            <iframe 
                width="100%" height="100%" 
                src="https://www.youtube.com/embed/l8SlZKk08Us?autoplay=1&controls=0&modestbranding=1&loop=1&playlist=l8SlZKk08Us" 
                title="Gemini Future" frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen 
                className="rounded-3xl shadow-[0_0_50px_rgba(0,242,255,0.3)] border border-white/10"
            ></iframe>
            <div className="absolute -bottom-20 left-0 right-0 text-center">
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple tracking-tighter drop-shadow-lg">THE FUTURE IS GEMINI</h1>
            </div>
        </div>
    </div>
);

// --- Helper Components ---
const LoadingSpinner = ({ label = "Thinking..." }) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-4">
    <div className="relative">
        <div className="w-16 h-16 border-4 border-void-700 rounded-full"></div>
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin"></div>
    </div>
    <p className="text-neon-cyan font-medium animate-pulse">{label}</p>
  </div>
);

const VideoPlaceholder = () => (
  <div className="w-full h-full bg-void-900 flex flex-col items-center justify-center text-white/30 space-y-3 border border-white/5 rounded-2xl">
    <div className="p-4 bg-void-800 rounded-full border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <Video className="w-8 h-8 text-neon-purple" />
    </div>
    <span className="text-sm font-medium">Simulation Ready</span>
  </div>
);

const GamificationBar: React.FC<{ profile: UserProfile }> = ({ profile }) => {
  const currentLevel = LEVELS.find(l => profile.xp < (LEVELS[l.level]?.xp || 99999)) || LEVELS[LEVELS.length - 1];
  const nextLevelXp = (LEVELS.find(l => l.level === currentLevel.level + 1)?.xp) || profile.xp * 1.5;
  const progress = Math.min(100, (profile.xp / nextLevelXp) * 100);

  return (
    <div className="glass-panel p-1 rounded-2xl mb-6 flex items-center gap-4 pr-6">
        <div className="h-14 w-14 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg transform -rotate-3 ml-2">
            <Trophy size={28} className="text-white" />
        </div>
        <div className="flex-1 py-3">
             <div className="flex justify-between items-end mb-2">
                <span className="font-bold text-white text-lg tracking-tight">{currentLevel.title}</span>
                <span className="text-xs text-gray-400 font-mono">Lvl {currentLevel.level}</span>
             </div>
             <div className="h-2 bg-void-900 rounded-full overflow-hidden border border-white/5">
                <div 
                    className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple shadow-[0_0_10px_rgba(0,242,255,0.5)] transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                />
             </div>
        </div>
        <div className="flex flex-col items-center justify-center pl-4 border-l border-white/10">
            <Flame size={20} className="text-orange-500 mb-1" />
            <span className="text-xs font-bold text-white">{profile.streak} Days</span>
        </div>
    </div>
  );
};

// --- Live Tutor Component ---
const LiveTutorMode: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const startSession = async () => {
      if (!process.env.API_KEY) return;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => setStatus("Gemini Live Active"),
          onmessage: (msg: LiveServerMessage) => {
              if (msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
                  const bin = atob(msg.serverContent.modelTurn.parts[0].inlineData.data);
                  const bytes = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
                  const floats = new Float32Array(new Int16Array(bytes.buffer).length).map((_, i) => new Int16Array(bytes.buffer)[i] / 32768.0);
                  const buff = outputCtx.createBuffer(1, floats.length, 24000);
                  buff.getChannelData(0).set(floats);
                  const src = outputCtx.createBufferSource();
                  src.buffer = buff;
                  src.connect(outputNode);
                  src.start();
              }
          }
        },
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' }}} }
      });

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(inputData.length);
          for(let i=0; i<inputData.length; i++) int16[i] = inputData[i] * 32768;
          const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
          sessionPromise.then(s => s.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: base64 } }));
      }
      source.connect(processor);
      processor.connect(inputCtx.destination);
      cleanup = () => { processor.disconnect(); source.disconnect(); stream.getTracks().forEach(t=>t.stop()); sessionPromise.then(s=>s.close()); };
    };
    startSession();
    return () => cleanup && cleanup();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-void-900 flex flex-col items-center justify-center">
       <div className="absolute inset-0 overflow-hidden">
         <video ref={videoRef} autoPlay muted className="w-full h-full object-cover opacity-30 scale-110 blur-sm" />
         <div className="absolute inset-0 bg-gradient-to-t from-void-900 via-transparent to-void-900"></div>
       </div>
       <div className="z-10 w-full max-w-md p-8 text-center space-y-6 animate-fade-in">
           <div className="relative inline-block">
               <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 animate-pulse"></div>
               <Activity className="text-red-500 relative z-10" size={64} strokeWidth={1.5} />
           </div>
           <div>
               <h2 className="text-3xl font-black text-white tracking-tight mb-2">Live Tutor</h2>
               <p className="text-red-400 font-mono text-sm uppercase tracking-widest animate-pulse">{status}</p>
           </div>
           <button onClick={onClose} aria-label="End Session" className="group relative px-8 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full font-bold border border-red-500/50 transition-all overflow-hidden">
               <span className="relative z-10 group-hover:text-red-100 transition-colors">End Session</span>
               <div className="absolute inset-0 bg-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
           </button>
       </div>
    </div>
  );
};

// --- Drawing Canvas ---
const DrawingCanvas: React.FC<{ onSave: (data: string) => void }> = ({ onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if(canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      if(ctx) { ctx.strokeStyle = '#00f2ff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; }
    }
  }, []);
  const start = (e: any) => { setIsDrawing(true); draw(e); };
  const stop = () => setIsDrawing(false);
  const draw = (e: any) => {
    if(!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    if (ctx) { ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y); }
  };
  const clear = () => { const c=canvasRef.current; c?.getContext('2d')?.clearRect(0,0,c!.width,c!.height); c?.getContext('2d')?.beginPath(); }
  return (
      <div className="h-64 bg-void-800 rounded-2xl border border-white/10 relative overflow-hidden shadow-inner">
          <canvas ref={canvasRef} className="w-full h-full cursor-crosshair touch-none"
            onMouseDown={(e) => { canvasRef.current?.getContext('2d')?.beginPath(); start(e); }}
            onMouseUp={stop} onMouseMove={draw}
            onTouchStart={(e) => { canvasRef.current?.getContext('2d')?.beginPath(); start(e); }}
            onTouchEnd={stop} onTouchMove={draw}
          />
          <div className="absolute bottom-3 right-3 flex gap-2">
             <button onClick={clear} aria-label="Clear Canvas" className="p-2 bg-void-900/80 text-white rounded-lg hover:bg-white/10 transition"><XCircle size={16}/></button>
             <button onClick={() => onSave(canvasRef.current?.toDataURL('image/jpeg') || '')} aria-label="Save Drawing" className="p-2 bg-neon-cyan/80 text-black rounded-lg hover:bg-neon-cyan transition font-bold text-xs">DONE</button>
          </div>
      </div>
  );
};

// --- Main App ---
export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [sessions, setSessions] = useState<QuestSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>({ dyslexicFont: false, readingRuler: false, aslAvatar: false, highContrast: false });
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  
  // Input & Processing
  const [inputMode, setInputMode] = useState<'upload'|'camera'|'draw'>('upload');
  const [inputText, setInputText] = useState('');
  const [inputHypothesis, setInputHypothesis] = useState('');
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [nanoPrompt, setNanoPrompt] = useState('');
  const [isNanoProcessing, setIsNanoProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [smartMonitorEnabled, setSmartMonitorEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const monitorIntervalRef = useRef<any>(null);
  const smartMonitorVideoRef = useRef<HTMLVideoElement>(null); // Hidden video for monitor

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    if (accessibility.dyslexicFont) document.documentElement.classList.add('font-dyslexic');
    else document.documentElement.classList.remove('font-dyslexic');
  }, [accessibility.dyslexicFont]);

  useEffect(() => {
    checkApiKey().then(hasKey => { if (!hasKey) selectApiKey().then(() => setApiKeyReady(true)); else setApiKeyReady(true); });
  }, []);

  // Smart Monitor Logic
  useEffect(() => {
      let stream: MediaStream | null = null;
      if(smartMonitorEnabled) {
          navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
              stream = s;
              if (smartMonitorVideoRef.current) {
                  smartMonitorVideoRef.current.srcObject = s;
                  smartMonitorVideoRef.current.play();
              }
              monitorIntervalRef.current = setInterval(async () => {
                   if (!smartMonitorVideoRef.current) return;
                   const canvas = document.createElement('canvas');
                   canvas.width = smartMonitorVideoRef.current.videoWidth;
                   canvas.height = smartMonitorVideoRef.current.videoHeight;
                   canvas.getContext('2d')?.drawImage(smartMonitorVideoRef.current, 0, 0);
                   const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
                   try {
                       const emotion = await detectUserEmotion(base64);
                       if (emotion.isConfused) {
                           const audio = new Audio(`data:audio/mp3;base64,${await generateNarration("I see you might be puzzled. " + emotion.advice)}`); 
                           audio.play();
                           setSmartMonitorEnabled(false); 
                       }
                   } catch(e) {}
              }, 10000); // Check every 10s to avoid rate limits
          });
      } else {
          clearInterval(monitorIntervalRef.current);
          if (smartMonitorVideoRef.current && smartMonitorVideoRef.current.srcObject) {
             (smartMonitorVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
          }
      }
      return () => { 
          clearInterval(monitorIntervalRef.current);
          stream?.getTracks().forEach(t => t.stop());
      };
  }, [smartMonitorEnabled]);

  useEffect(() => {
      if (sessions.some(s => s.userScore !== undefined)) window.confetti?.({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }, [sessions]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onloadend = () => setInputImage(reader.result as string); reader.readAsDataURL(file); }
  };

  const handleNanoEdit = async () => {
      if (!inputImage || !nanoPrompt) return;
      setIsNanoProcessing(true);
      try { const newImage = await editImageWithNano(inputImage.split(',')[1], nanoPrompt); setInputImage(newImage); setNanoPrompt(''); } catch (e) { alert("Failed to style."); } finally { setIsNanoProcessing(false); }
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video'); video.srcObject = stream; await video.play();
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0); setInputImage(canvas.toDataURL('image/jpeg'));
      stream.getTracks().forEach(t => t.stop());
    } catch (err) { alert("Camera unavailable."); }
  };

  const toggleRecording = async () => {
    if (isRecording) { mediaRecorderRef.current?.stop(); setIsRecording(false); } 
    else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder; audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
          const reader = new FileReader(); reader.onloadend = () => setRecordedAudio((reader.result as string).split(',')[1]);
          reader.readAsDataURL(audioBlob); stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start(); setIsRecording(true);
      } catch (err) { alert("Mic denied."); }
    }
  };

  const startQuest = async () => {
    // EASTER EGG CHECK
    if (inputText.toLowerCase().includes('show me the future')) {
        setShowTrailer(true);
        return;
    }

    if (!inputText && !inputImage && !recordedAudio) return;
    if (!apiKeyReady) { await selectApiKey(); setApiKeyReady(true); }
    setIsProcessing(true);
    
    const newSession: QuestSession = {
      id: crypto.randomUUID(),
      inputs: { text: inputText, image: inputImage?.split(',')[1], audio: recordedAudio || undefined, hypothesis: inputHypothesis },
      isVideoLoading: false, isViralLoading: false, chatHistory: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);

    try {
      const result = await analyzeQuestInputs(newSession.inputs.text, newSession.inputs.image, newSession.inputs.audio, newSession.inputs.hypothesis);
      setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, result, videoConfig: { prompt: result.videoPrompt, aspectRatio: '16:9', useInputImage: !!newSession.inputs.image } } : s));
      generateNarration(result.explanation).then(audioUrl => setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, generatedAudioUrl: audioUrl } : s)));
      fetchRealTimeData(result.title).then(data => setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, isSearchLoading: false, result: { ...s.result!, searchData: data } } : s)));
      if (navigator.geolocation) {
           navigator.geolocation.getCurrentPosition(pos => {
               fetchMapData(result.title, pos.coords.latitude, pos.coords.longitude).then(data => setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, isMapLoading: false, result: { ...s.result!, mapData: data } } : s)));
           });
      }
      setInputText(''); setInputImage(null); setRecordedAudio(null); setInputHypothesis('');
    } catch (error) { console.error(error); alert("Error processing quest."); } finally { setIsProcessing(false); }
  };

  const handleGenerateVideo = async (session: QuestSession) => {
      if(!session.videoConfig || !session.result) return;
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isVideoLoading: true } : s));
      try {
          const img = session.videoConfig.useInputImage ? session.inputs.image : undefined;
          const url = await generateExplainerVideo(session.videoConfig.prompt, session.videoConfig.aspectRatio, img);
          setSessions(prev => prev.map(s => s.id === session.id ? { ...s, generatedVideoUrl: url, isVideoLoading: false } : s));
      } catch (e) { setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isVideoLoading: false } : s)); }
  };

  const handleChatSend = async () => {
      if(!chatInput || !currentSession) return;
      const history = currentSession.chatHistory || [];
      const newHistory = [...history, { role: 'user' as const, text: chatInput }];
      setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, chatHistory: newHistory } : s));
      setChatInput('');
      try {
          const context = `Topic: ${currentSession.result?.title}. Explanation: ${currentSession.result?.explanation}`;
          const response = await chatWithAgent(newHistory.length === 1 ? [{ role: 'user', text: context }, ...newHistory] : newHistory, chatInput);
          setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, chatHistory: [...newHistory, { role: 'model', text: response }] } : s));
      } catch (e) { console.error(e); }
  };

  const handleExportViral = (session: QuestSession) => {
      if (!session.generatedVideoUrl) { alert("Generate a video first!"); return; }
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isViralLoading: true } : s));
      // Mock Export delay
      setTimeout(() => {
          setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isViralLoading: false } : s));
          const link = document.createElement('a');
          link.href = session.generatedVideoUrl!;
          link.download = 'GeminiQuest_Viral.mp4';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.confetti?.({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      }, 1500);
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const hasResult = !!currentSession?.result;

  if (showIntro) return <ConstellationVisualizer onSkip={() => setShowIntro(false)} />;
  if (showTrailer) return <TrailerOverlay onClose={() => setShowTrailer(false)} />;
  if (isLiveMode) return <LiveTutorMode onClose={() => setIsLiveMode(false)} />;

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'dark' : ''} ${accessibility.highContrast ? 'contrast-150' : ''} bg-gray-50 dark:bg-void-900 text-gray-900 dark:text-gray-100`}>
      {accessibility.readingRuler && <div className="reading-ruler" style={{ top: '50%' }} />}
      <video ref={smartMonitorVideoRef} className="hidden" muted />
      
      <div className="flex-1 flex flex-col md:flex-row h-screen overflow-hidden">
        
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'w-80 translate-x-0' : '-translate-x-full w-0'} md:w-80 md:translate-x-0 transition-all duration-300 bg-white dark:bg-void-800 border-r border-gray-200 dark:border-white/5 flex flex-col z-30 absolute md:relative h-full shadow-2xl md:shadow-none`}>
            <div className="p-6 border-b border-gray-200 dark:border-white/5 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gradient">My Quests</h2>
                <button onClick={() => setIsSidebarOpen(false)} aria-label="Close Sidebar" className="md:hidden p-2 text-gray-400"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {sessions.map(s => (
                    <div key={s.id} onClick={() => { setCurrentSessionId(s.id); setIsSidebarOpen(false); }} className={`p-4 rounded-xl cursor-pointer transition-all border group ${s.id === currentSessionId ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-[0_0_15px_rgba(0,242,255,0.1)]' : 'hover:bg-white/5 border-transparent'}`}>
                        <div className={`font-semibold truncate ${s.id === currentSessionId ? 'text-neon-cyan' : 'text-gray-300 group-hover:text-white'}`}>{s.result?.title || "Thinking..."}</div>
                        <div className="text-xs text-gray-500 mt-1">{new Date(s.result?.timestamp || Date.now()).toLocaleDateString()}</div>
                    </div>
                ))}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-white/5 space-y-1">
                 <button onClick={() => setShowSettings(!showSettings)} aria-label="Toggle Accessibility" className="flex items-center space-x-3 text-sm text-gray-400 hover:text-neon-cyan w-full p-2 transition-colors">
                     <Accessibility size={18} /> <span>Accessibility</span>
                 </button>
                 {showSettings && (
                     <div className="bg-void-900/50 p-3 rounded-lg text-xs space-y-2 border border-white/5 animate-fade-in">
                         {Object.entries(accessibility).map(([k,v]) => (
                             <label key={k} className="flex items-center space-x-2 cursor-pointer">
                                 <input type="checkbox" checked={v} onChange={e => setAccessibility(p=>({...p, [k]: e.target.checked}))} className="accent-neon-cyan" /> 
                                 <span className="capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                             </label>
                         ))}
                     </div>
                 )}
                 <button onClick={() => setDarkMode(!darkMode)} aria-label="Toggle Theme" className="flex items-center space-x-3 text-sm text-gray-400 hover:text-neon-purple w-full p-2 transition-colors">
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />} <span>Theme</span>
                </button>
                <div className="text-[10px] text-center text-gray-500 pt-2 font-mono">Powered by Gemini 3.0</div>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <header className="h-16 border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-6 bg-white/80 dark:bg-void-900/80 backdrop-blur-md z-20">
                <div className="flex items-center space-x-4">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-white/5 rounded-lg text-gray-400"><Menu size={24} /></button>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <span className="text-white">Gemini</span><span className="text-neon-cyan">Quest</span>
                        <Sparkles className="text-neon-purple animate-pulse-slow" size={16} />
                    </h1>
                </div>
                <div className="flex items-center space-x-3">
                    <button onClick={() => setIsLiveMode(true)} aria-label="Start Live Mode" className="flex items-center space-x-2 px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full text-xs font-bold border border-red-500/30 transition-all animate-pulse">
                         <Radio size={14} /> <span>LIVE</span>
                    </button>
                    <button onClick={() => { setCurrentSessionId(null); setInputText(''); setInputImage(null); }} aria-label="New Quest" className="flex items-center space-x-2 px-4 py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 rounded-full font-bold text-sm transition-all">
                        <RefreshCw size={16} /> <span className="hidden sm:inline">New Quest</span>
                    </button>
                    <button onClick={() => setShowChat(!showChat)} aria-label="Toggle Chat" className={`p-2 rounded-full transition-colors ${showChat ? 'bg-neon-purple text-white shadow-lg shadow-neon-purple/30' : 'text-gray-400 hover:bg-white/5'}`}>
                        <MessageCircle size={20} />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth flex relative">
                <div className="flex-1 max-w-6xl mx-auto w-full">
                    <GamificationBar profile={profile} />
                    {!hasResult && !isProcessing && (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-float">
                            <div className="w-full max-w-2xl glass-panel p-8 rounded-3xl space-y-6">
                                <h2 className="text-3xl font-bold text-center text-white mb-2">What will we discover?</h2>
                                <div className="flex justify-center space-x-2 mb-4 bg-void-900/50 p-1 rounded-xl w-fit mx-auto border border-white/5">
                                    {['upload', 'camera', 'draw'].map(m => (
                                        <button key={m} onClick={()=>setInputMode(m as any)} className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${inputMode===m ? 'bg-void-700 text-neon-cyan shadow-sm' : 'text-gray-400 hover:text-white'}`}>{m}</button>
                                    ))}
                                </div>
                                <div className="space-y-4">
                                    <div className="w-full">
                                        {inputMode === 'upload' && (
                                            <button onClick={() => document.getElementById('file-upload')?.click()} className="h-48 w-full rounded-2xl bg-void-800/50 border-2 border-dashed border-gray-600 hover:border-neon-cyan group flex flex-col items-center justify-center transition-all overflow-hidden relative">
                                                {inputImage ? <img src={inputImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" /> : <><ImageIcon className="text-gray-500 group-hover:text-neon-cyan mb-2 transition-colors" size={32}/><span className="text-sm text-gray-400">Upload Image</span></>}
                                            </button>
                                        )}
                                        {inputMode === 'camera' && (
                                            <button onClick={handleCameraCapture} className="h-48 w-full rounded-2xl bg-void-800/50 border-2 border-dashed border-gray-600 hover:border-neon-cyan group flex flex-col items-center justify-center transition-all overflow-hidden relative">
                                                 {inputImage ? <img src={inputImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" /> : <><Camera className="text-gray-500 group-hover:text-neon-cyan mb-2 transition-colors" size={32}/><span className="text-sm text-gray-400">Snap Photo</span></>}
                                            </button>
                                        )}
                                        {inputMode === 'draw' && ( <DrawingCanvas onSave={setInputImage} /> )}
                                        <input type="file" id="file-upload" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                    </div>
                                    {inputImage && (
                                        <div className="flex items-center space-x-2 bg-void-900/50 p-2 rounded-xl border border-white/10">
                                            <Edit size={16} className="text-neon-purple ml-2" />
                                            <input value={nanoPrompt} onChange={(e) => setNanoPrompt(e.target.value)} placeholder="AI Style (e.g. 'cyberpunk')" className="flex-1 bg-transparent border-none text-sm focus:ring-0 text-white placeholder-gray-500" />
                                            <button onClick={handleNanoEdit} disabled={isNanoProcessing} className="px-4 py-1.5 bg-neon-purple/20 text-neon-purple border border-neon-purple/50 rounded-lg text-xs font-bold hover:bg-neon-purple/30 transition-colors">
                                                {isNanoProcessing ? '...' : 'Style'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <div className="relative group">
                                        <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Ask a question..." className="w-full h-24 p-4 pr-16 rounded-xl bg-void-800/50 border border-white/10 focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan resize-none transition-all text-white placeholder-gray-500" />
                                        <button onClick={toggleRecording} aria-label="Toggle Microphone" className={`absolute bottom-3 right-3 p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-void-700 text-gray-400 hover:text-white hover:bg-void-600'}`}><Mic size={20} /></button>
                                    </div>
                                    <input value={inputHypothesis} onChange={(e) => setInputHypothesis(e.target.value)} placeholder="(Optional) My hypothesis is..." className="w-full p-3 rounded-xl bg-void-800/30 border border-white/10 text-sm text-white placeholder-gray-600 focus:border-neon-cyan/50 focus:ring-0 transition-all" />
                                </div>
                                <button onClick={startQuest} aria-label="Launch Quest" className="w-full py-4 bg-gradient-to-r from-neon-cyan to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black uppercase tracking-wider rounded-xl text-lg shadow-[0_0_20px_rgba(0,242,255,0.3)] transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2">
                                    <span>Launch Quest</span> <Send size={20} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                    )}

                    {isProcessing && <LoadingSpinner label="Consulting Gemini 3 Pro..." />}

                    {hasResult && currentSession && currentSession.result && (
                        <div className="space-y-6 animate-fade-in pb-20">
                            <div className="flex justify-between items-center bg-void-800/50 p-2 rounded-xl border border-white/5 backdrop-blur">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-2">Gemini Ecosystem</div>
                                <div className="flex space-x-2">
                                    <button onClick={() => setSmartMonitorEnabled(!smartMonitorEnabled)} aria-label="Toggle Smart Monitor" className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${smartMonitorEnabled ? 'bg-neon-green/10 text-neon-green border border-neon-green/30' : 'bg-void-700 text-gray-400'}`}>
                                        <Eye size={12} /> <span>Smart Monitor</span>
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
                                <div className="glass-panel p-1 rounded-2xl overflow-hidden relative flex flex-col group">
                                    <div className="flex-1 relative bg-black/50 overflow-hidden rounded-xl">
                                        {currentSession.isVideoLoading ? <LoadingSpinner label="Simulating (Veo)..." /> : 
                                          currentSession.generatedVideoUrl ? (
                                              <video src={currentSession.generatedVideoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                                          ) : <VideoPlaceholder />
                                        }
                                        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-white border border-white/20 flex items-center gap-1">
                                            <Video size={10} /> Veo Studio
                                        </div>
                                    </div>
                                    {!currentSession.generatedVideoUrl && !currentSession.isVideoLoading && (
                                        <div className="p-4 space-y-3 bg-void-900/80">
                                            <textarea value={currentSession.videoConfig?.prompt || ''} onChange={(e) => setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, videoConfig: { ...s.videoConfig!, prompt: e.target.value } } : s))} className="w-full bg-void-800 text-gray-300 text-xs p-3 rounded-lg border border-white/5 h-16 resize-none focus:border-neon-purple focus:ring-0 transition-colors" placeholder="Describe simulation..." />
                                            <div className="flex justify-between items-center">
                                                <div className="flex space-x-2 bg-void-800 rounded-lg p-1">
                                                    {['16:9', '9:16'].map(ratio => (
                                                        <button key={ratio} onClick={() => setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, videoConfig: { ...s.videoConfig!, aspectRatio: ratio as any } } : s))} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${currentSession.videoConfig?.aspectRatio===ratio ? 'bg-void-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>{ratio}</button>
                                                    ))}
                                                </div>
                                                <button onClick={() => handleGenerateVideo(currentSession)} className="px-4 py-1.5 bg-gradient-to-r from-neon-purple to-pink-600 text-white text-xs font-bold rounded-lg hover:brightness-110 shadow-lg shadow-neon-purple/20 transition-all">Simulate</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="glass-panel rounded-2xl p-6 flex flex-col">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Activity size={14} className="text-neon-cyan" />{currentSession.result.visualTitle}</h3>
                                    <div className="flex-1 w-full min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={currentSession.result.visualData}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                                                <XAxis dataKey="label" stroke="#6b7280" tick={{fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                                                <YAxis stroke="#6b7280" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} itemStyle={{ color: '#00f2ff' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                                <Bar dataKey="value" fill="url(#colorGradient)" radius={[6, 6, 0, 0]}>
                                                    {currentSession.result.visualData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#00f2ff' : '#bd00ff'} fillOpacity={0.8} /> ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="glass-panel rounded-2xl p-8 space-y-6 relative">
                                        {accessibility.aslAvatar && (
                                            <div className="absolute top-4 right-4 w-40 h-40 border-2 border-neon-cyan rounded-2xl overflow-hidden bg-black z-10 shadow-[0_0_20px_rgba(0,242,255,0.3)] animate-fade-in">
                                                <img src="https://media.giphy.com/media/l41lFj8af6V5n5tLi/giphy.gif" alt="ASL Signer" className="w-full h-full object-cover opacity-90" />
                                                <div className="absolute bottom-0 w-full bg-black/80 text-[10px] font-bold tracking-widest text-center text-white py-1">ASL INTERPRETER</div>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-start">
                                            <h2 className="text-4xl font-black text-white tracking-tight leading-tight">{currentSession.result.title}</h2>
                                            <div className="flex space-x-2">
                                                {currentSession.generatedAudioUrl && (
                                                    <button className="p-3 bg-neon-cyan/10 rounded-full text-neon-cyan hover:bg-neon-cyan/20 transition-colors">
                                                        <Music size={20} /> <audio autoPlay src={currentSession.generatedAudioUrl} className="hidden" />
                                                    </button>
                                                )}
                                                {currentSession.generatedVideoUrl && (
                                                    <button onClick={() => handleExportViral(currentSession)} className="p-3 bg-pink-500/10 rounded-full text-pink-500 hover:bg-pink-500/20 transition-colors" title="Export Viral Clip">
                                                        {currentSession.isViralLoading ? <div className="animate-spin w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full"/> : <Share2 size={20} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-p:leading-loose prose-headings:text-white prose-strong:text-neon-cyan">
                                            <p>{currentSession.result.explanation}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                                            <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/20">Confidence: {currentSession.result.confidenceScore}%</span>
                                            {currentSession.result.citations?.map((c,i) => <span key={i} className="bg-void-900 text-gray-400 px-3 py-1 rounded-full text-xs border border-white/5 hover:border-white/20 transition-colors cursor-help">{c}</span>)}
                                        </div>
                                        <details className="group">
                                            <summary className="list-none cursor-pointer flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-neon-purple transition-colors">
                                                <ChevronRight className="group-open:rotate-90 transition-transform" size={16} /> Reasoning Chain
                                            </summary>
                                            <div className="mt-4 p-4 bg-void-900/50 rounded-xl border border-white/5 text-gray-400 font-mono text-xs leading-relaxed">{currentSession.result.reasoningSummary}</div>
                                        </details>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="glass-panel p-5 rounded-2xl border-l-4 border-blue-500 bg-gradient-to-br from-void-800 to-void-900">
                                            <h4 className="font-bold flex items-center space-x-2 text-blue-400 mb-3"><Globe size={16}/> <span>Live Search</span></h4>
                                            {currentSession.isSearchLoading ? <div className="text-xs text-gray-500 animate-pulse">Scanning web...</div> : (
                                                <div className="space-y-3">
                                                    <p className="text-sm text-gray-300 leading-relaxed">{currentSession.result.searchData?.summary}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {currentSession.result.searchData?.sources.slice(0,2).map((s, i) => (
                                                            <a key={i} href={s.uri} target="_blank" className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-1 rounded hover:bg-blue-500/20 transition truncate max-w-[150px]">{s.title}</a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="glass-panel p-5 rounded-2xl border-l-4 border-green-500 bg-gradient-to-br from-void-800 to-void-900">
                                            <h4 className="font-bold flex items-center space-x-2 text-green-400 mb-3"><MapPin size={16}/> <span>Local Context</span></h4>
                                            {currentSession.isMapLoading ? <div className="text-xs text-gray-500 animate-pulse">Locating...</div> : (
                                                <div className="space-y-3">
                                                    <p className="text-sm text-gray-300 leading-relaxed">{currentSession.result.mapData?.summary}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {currentSession.result.mapData?.links.slice(0,2).map((s, i) => (
                                                            <a key={i} href={s.uri} target="_blank" className="text-[10px] bg-green-500/10 text-green-300 px-2 py-1 rounded hover:bg-green-500/20 transition truncate max-w-[150px]">{s.title}</a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="glass-panel rounded-2xl p-6 bg-gradient-to-br from-void-800 to-indigo-900/20 border-t border-indigo-500/20">
                                        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Trophy size={16} /> Knowledge Check</h3>
                                        <QuizComponent 
                                            questions={currentSession.result.quiz} 
                                            onComplete={(score) => {
                                                if (currentSession.userScore === undefined) {
                                                    const xpGain = score * 50;
                                                    setProfile(p => ({ ...p, xp: p.xp + xpGain }));
                                                    setSessions(prev => prev.map(s => s.id === currentSession?.id ? { ...s, userScore: score } : s));
                                                }
                                            }}
                                            isCompleted={currentSession.userScore !== undefined}
                                        />
                                    </div>
                                     <div className="space-y-3">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Continue Journey</h3>
                                        {currentSession.result.nextQuestSuggestions.map((suggestion, idx) => (
                                            <button key={idx} onClick={() => { setInputText(suggestion); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full p-4 rounded-xl bg-void-800 border border-white/5 hover:border-neon-cyan/50 hover:bg-void-700 transition-all text-left group">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold text-neon-cyan">Path {idx + 1}</span>
                                                    <ArrowRight size={14} className="text-gray-500 group-hover:text-neon-cyan transform group-hover:translate-x-1 transition-all" />
                                                </div>
                                                <p className="text-sm text-gray-300 group-hover:text-white transition-colors">{suggestion}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {showChat && (
                    <div className="w-80 bg-void-800 border-l border-white/10 flex flex-col h-full absolute right-0 top-0 z-40 shadow-2xl animate-fade-in">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-void-900/50">
                            <h3 className="font-bold text-white flex items-center gap-2"><Sparkles size={14} className="text-neon-purple"/> AI Tutor</h3>
                            <button onClick={() => setShowChat(false)} className="text-gray-500 hover:text-white"><X size={16}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {currentSession?.chatHistory?.length === 0 && <div className="text-center text-gray-500 text-sm mt-10">Ask me anything about this quest!</div>}
                            {currentSession?.chatHistory?.map((msg, i) => (
                                <div key={i} className={`p-3 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-neon-cyan/10 text-neon-cyan ml-4 border border-neon-cyan/20' : 'bg-void-700 text-gray-200 mr-4 border border-white/5'}`}>{msg.text}</div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-white/5 bg-void-900/50">
                            <div className="flex gap-2">
                                <input className="flex-1 bg-void-950 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-neon-purple focus:ring-0 transition-colors" placeholder="Type a message..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSend()} />
                                <button onClick={handleChatSend} className="bg-neon-purple p-2.5 rounded-lg text-white hover:brightness-110 transition-all"><Send size={16}/></button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
      </div>
    </div>
  );
}

// --- Quiz Component ---
const QuizComponent: React.FC<{ questions: QuizQuestion[], onComplete: (score: number) => void, isCompleted: boolean }> = ({ questions, onComplete, isCompleted }) => {
    const [currentQ, setCurrentQ] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [score, setScore] = useState(0);
    const [showFeedback, setShowFeedback] = useState(false);

    const handleAnswer = (idx: number) => {
        if (showFeedback || isCompleted) return;
        setSelected(idx);
        if (idx === questions[currentQ].correctIndex) setScore(s => s + 1);
        setShowFeedback(true);
    };
    const nextQuestion = () => {
        if (currentQ < questions.length - 1) { setCurrentQ(c => c + 1); setSelected(null); setShowFeedback(false); } 
        else { onComplete(score + (selected === questions[currentQ].correctIndex ? 1 : 0)); }
    };

    if (isCompleted) return (
        <div className="text-center py-6 animate-slide-up">
            <div className="text-5xl mb-3">🎉</div>
            <h4 className="text-xl font-bold text-white mb-1">Quest Complete!</h4>
            <p className="text-gray-400 text-sm">You earned <span className="text-neon-cyan font-bold">{score * 50} XP</span></p>
        </div>
    );

    const q = questions[currentQ];
    return (
        <div className="space-y-4">
            <div className="flex justify-between text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                <span>Question {currentQ + 1} / {questions.length}</span>
                <span>Score: {score}</span>
            </div>
            <p className="font-semibold text-white leading-relaxed">{q.question}</p>
            <div className="space-y-2">
                {q.options.map((opt, idx) => {
                    let btnClass = "w-full p-3 rounded-lg text-left text-sm transition-all border ";
                    if (showFeedback) {
                        if (idx === q.correctIndex) btnClass += "bg-green-500/20 border-green-500/50 text-green-300";
                        else if (idx === selected) btnClass += "bg-red-500/20 border-red-500/50 text-red-300";
                        else btnClass += "bg-void-950 border-transparent opacity-40";
                    } else {
                        btnClass += "bg-void-950 border-white/5 hover:border-neon-cyan/50 hover:bg-void-900 text-gray-300";
                    }
                    return <button key={idx} onClick={() => handleAnswer(idx)} className={btnClass}>{opt}</button>
                })}
            </div>
            {showFeedback && (
                <div className="pt-3 animate-fade-in">
                    <div className="text-xs text-gray-400 mb-4 bg-void-950 p-3 rounded-lg border border-white/5">{q.explanation}</div>
                    <button onClick={nextQuestion} className="w-full py-2.5 bg-white text-black rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors">
                        {currentQ < questions.length - 1 ? "Next Question" : "Collect XP"}
                    </button>
                </div>
            )}
        </div>
    );
};