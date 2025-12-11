import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, Mic, Image as ImageIcon, Send, Moon, Sun, 
  Share2, ChevronRight, Trophy, Flame, Menu, X, RefreshCw, PlayCircle, StopCircle, Video, Activity,
  PenTool, Eye, Accessibility, Download, Sparkles, Smile, Radio, Edit, Globe, MapPin, MessageCircle, ArrowRight, XCircle, Search, Music, Zap, Mic2, AlertCircle, PanelLeft, LayoutTemplate, Trash2
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
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
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
                <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white mb-2 drop-shadow-[0_0_15px_rgba(0,242,255,0.5)]">
                    GeminiQuest
                </h1>
                <p className="text-neon-cyan text-lg md:text-xl tracking-widest uppercase font-light">Ignite Curiosity</p>
            </div>
            <button onClick={onSkip} aria-label="Skip Intro" className="absolute bottom-10 z-20 text-white/40 hover:text-white border border-white/10 px-6 py-2 rounded-full text-sm uppercase tracking-wider hover:bg-white/5 transition-all">
                Skip Intro
            </button>
        </div>
    );
};

// --- EASTER EGG COMPONENT ---
const TrailerOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center animate-fade-in p-4">
        <button onClick={onClose} aria-label="Close Trailer" className="absolute top-4 right-4 md:top-8 md:right-8 text-white/50 hover:text-white z-50 p-2 bg-white/10 rounded-full backdrop-blur-md"><X size={32}/></button>
        <div className="w-full max-w-5xl aspect-video relative">
            <iframe 
                width="100%" height="100%" 
                src="https://www.youtube.com/embed/l8SlZKk08Us?autoplay=1&controls=0&modestbranding=1&loop=1&playlist=l8SlZKk08Us" 
                title="Gemini Future" frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen 
                className="rounded-3xl shadow-[0_0_50px_rgba(0,242,255,0.3)] border border-white/10"
            ></iframe>
            <div className="absolute -bottom-16 left-0 right-0 text-center hidden md:block">
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple tracking-tighter drop-shadow-lg">THE FUTURE IS GEMINI</h1>
            </div>
        </div>
    </div>
);

// --- THUMBNAIL VIEW COMPONENT (FOR WRITEUP) ---
const ThumbnailView = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4">
      <button onClick={onClose} className="absolute top-4 right-4 text-white z-50 bg-white/10 p-2 rounded-full"><X /></button>
      <div className="relative w-[1120px] h-[560px] bg-void-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col items-center justify-center select-none transform scale-50 md:scale-75 lg:scale-100 transition-transform">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,242,255,0.1),transparent_70%)]"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        
        {/* Main Content */}
        <div className="z-10 text-center space-y-4">
            <h1 className="text-8xl font-black text-white tracking-tighter flex items-center justify-center gap-4 drop-shadow-[0_0_35px_rgba(0,242,255,0.4)]">
                <span>Gemini</span><span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple">Quest</span>
                <Sparkles size={80} className="text-neon-purple animate-pulse-slow" />
            </h1>
            <p className="text-3xl text-gray-300 font-light tracking-widest uppercase">The Multimodal AI Science Tutor</p>
        </div>

        {/* Floating Cards Mockup */}
        <div className="absolute bottom-16 left-16 flex gap-6 opacity-90">
            <div className="w-48 h-32 bg-void-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-2 shadow-lg shadow-neon-cyan/10 transform -rotate-3">
                <div className="flex items-center gap-2 text-neon-cyan text-xs font-bold uppercase tracking-wider"><PenTool size={14}/> Sketch Input</div>
                <div className="flex-1 bg-white/5 rounded-lg border border-white/5 relative overflow-hidden flex items-center justify-center">
                    <Activity className="text-white/50" />
                </div>
            </div>
            <div className="w-48 h-32 bg-void-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-2 shadow-lg shadow-neon-purple/10 transform rotate-3">
                <div className="flex items-center gap-2 text-neon-purple text-xs font-bold uppercase tracking-wider"><Video size={14}/> Veo Simulation</div>
                <div className="flex-1 bg-gradient-to-br from-neon-purple/20 to-blue-500/20 rounded-lg border border-white/5 relative">
                     <div className="absolute inset-0 flex items-center justify-center"><PlayCircle className="text-white/80" /></div>
                </div>
            </div>
        </div>

        {/* Badges */}
        <div className="absolute top-12 right-12 flex flex-col items-end gap-3">
            <div className="bg-white/5 backdrop-blur-md px-5 py-2 rounded-full border border-white/10 text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <img src="https://lh3.googleusercontent.com/ULl0c2d3u_j0c4e7o8k-7y-0-5Q4a7a9-0-5-0-5" className="w-4 h-4 rounded-full bg-white" alt=""/> Google AI Studio
            </div>
            <div className="bg-gradient-to-r from-neon-cyan to-neon-purple px-6 py-3 rounded-full text-black font-black text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(0,242,255,0.4)] flex items-center gap-2">
                <Sparkles size={16} fill="black" /> Gemini 3 Pro
            </div>
        </div>

        <div className="absolute bottom-6 right-12 text-white/30 text-xs font-mono tracking-widest">
            HACKATHON SUBMISSION: EDUCATION TRACK
        </div>
      </div>
    </div>
  )
}

// --- Helper Components ---
const LoadingSpinner = ({ label = "Thinking...", onCancel }: { label?: string, onCancel?: () => void }) => (
  <div className="flex flex-col items-center justify-center p-12 space-y-6">
    <div className="relative">
        <div className="w-20 h-20 border-4 border-gray-200 dark:border-void-700 rounded-full"></div>
        <div className="absolute top-0 left-0 w-20 h-20 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin"></div>
    </div>
    <div className="text-center space-y-2">
        <p className="text-gray-900 dark:text-neon-cyan text-lg font-medium animate-pulse">{label}</p>
        {onCancel && (
            <button onClick={onCancel} className="mt-4 px-6 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full text-sm font-bold transition-colors flex items-center gap-2 mx-auto border border-red-500/20">
                <RefreshCw size={16} /> Stop & Refresh
            </button>
        )}
    </div>
  </div>
);

const GroundingSkeleton = () => (
    <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4"></div>
        <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-full"></div>
            <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-4/6"></div>
        </div>
        <div className="flex gap-2 pt-2">
            <div className="h-6 w-24 bg-gray-200 dark:bg-white/10 rounded"></div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-white/10 rounded"></div>
        </div>
    </div>
);

const VideoPlaceholder = () => (
  <div className="w-full h-full bg-gray-100 dark:bg-void-900 flex flex-col items-center justify-center text-gray-400 dark:text-white/30 space-y-3 border border-gray-200 dark:border-white/5 rounded-2xl min-h-[200px]">
    <div className="p-4 bg-white dark:bg-void-800 rounded-full border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <Video className="w-8 h-8 text-neon-purple" />
    </div>
    <span className="text-sm font-medium">Simulation Ready</span>
  </div>
);

// ... GamificationBar and LiveTutorMode remain the same ...
const GamificationBar: React.FC<{ profile: UserProfile }> = ({ profile }) => {
  const currentLevel = LEVELS.find(l => profile.xp < (LEVELS[l.level]?.xp || 99999)) || LEVELS[LEVELS.length - 1];
  const nextLevelXp = (LEVELS.find(l => l.level === currentLevel.level + 1)?.xp) || profile.xp * 1.5;
  const progress = Math.min(100, (profile.xp / nextLevelXp) * 100);

  return (
    <div className="glass-panel p-3 rounded-2xl mb-8 flex items-center gap-4 border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <div className="h-14 w-14 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg ml-2 shrink-0 transform rotate-3">
            <Trophy size={28} className="text-white" />
        </div>
        <div className="flex-1 py-2 overflow-hidden">
             <div className="flex justify-between items-end mb-2">
                <span className="font-bold text-gray-800 dark:text-white text-lg truncate pr-2 tracking-tight">{currentLevel.title}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono shrink-0 uppercase tracking-widest">Level {currentLevel.level}</span>
             </div>
             <div className="h-3 bg-gray-200 dark:bg-void-900 rounded-full overflow-hidden border border-gray-200 dark:border-white/5">
                <div 
                    className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple shadow-[0_0_15px_rgba(0,242,255,0.5)] transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                />
             </div>
        </div>
        <div className="flex flex-col items-center justify-center px-6 border-l border-gray-200 dark:border-white/10 shrink-0 space-y-1">
            <Flame size={20} className="text-orange-500" />
            <span className="text-xs font-bold text-gray-700 dark:text-white">{profile.streak} Days</span>
        </div>
    </div>
  );
};

const LiveTutorMode: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Initializing...");
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Use a ref to track active session for cleanup
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let videoInterval: any;
    let isActive = true; // Guard for async operations

    const startSession = async () => {
      // 1. Check API Key
      if (!process.env.API_KEY) {
          setStatus("API Key Needed");
          // Try to trigger selection
           if ((window as any).aistudio) {
             await (window as any).aistudio.openSelectKey();
             if (!process.env.API_KEY) {
                setStatus("API Key Missing");
                return;
             }
           } else {
             return;
           }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      try {
        setStatus("Accessing Media...");
        // 2. Media Setup
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputCtx;
        
        // Critical: Resume contexts to unlock audio in some browsers
        await inputCtx.resume();
        await outputCtx.resume();

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!isActive) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        streamRef.current = stream;

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.volume = 0;
            videoRef.current.play();
        }

        // 3. Audio Processing
        const analyser = inputCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = inputCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVolume = () => {
            if (!isActive) return;
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a,b) => a+b) / dataArray.length;
            setVolume(avg);
            requestAnimationFrame(updateVolume);
        };
        updateVolume();

        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputCtx.destination);

        // 4. Connect to Gemini
        setStatus("Connecting...");
        
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: { 
              responseModalities: [Modality.AUDIO], 
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' }}},
              systemInstruction: "You are a patient, empathetic science tutor. Your goal is to explain concepts clearly. Listen carefully to the user's tone. If they sound confused, hesitant, or ask for clarification, immediately stop, apologize, and explain the concept again more simply and slowly. If they ask you to speak slower, adjust your rate. Be conversational, encouraging, and allow them to interrupt you. YOU CAN SEE THE USER via their camera. If they show you an object or drawing, describe it and help them with it. Always be brief."
            },
            callbacks: {
              onopen: () => {
                 if (!isActive) return;
                 setStatus("Listening...");
                 
                 // Audio Send
                 scriptProcessor.onaudioprocess = (e) => {
                     if (!isActive) return;
                     const inputData = e.inputBuffer.getChannelData(0);
                     const pcm16 = new Int16Array(inputData.length);
                     for (let i = 0; i < inputData.length; i++) {
                         pcm16[i] = inputData[i] * 0x7FFF;
                     }
                     
                     // Manual binary construction to avoid stack overflow with large arrays
                     let binary = '';
                     const bytes = new Uint8Array(pcm16.buffer);
                     const len = bytes.byteLength;
                     for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                     }
                     const base64 = btoa(binary);

                     sessionPromise.then(session => session.sendRealtimeInput({
                         media: { mimeType: 'audio/pcm;rate=16000', data: base64 }
                     }));
                 };

                 // Video Send
                 const canvas = document.createElement('canvas');
                 const ctx = canvas.getContext('2d');
                 videoInterval = setInterval(() => {
                    if (!isActive) return;
                    if (videoRef.current && ctx && videoRef.current.readyState === 4) {
                        canvas.width = videoRef.current.videoWidth * 0.5;
                        canvas.height = videoRef.current.videoHeight * 0.5;
                        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                        const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                        sessionPromise.then(session => session.sendRealtimeInput({
                            media: { mimeType: 'image/jpeg', data: base64 }
                        }));
                    }
                 }, 500);
              },
              onmessage: async (msg: LiveServerMessage) => {
                  if (!isActive) return;
                  // Handle interruptions
                  if (msg.serverContent?.interrupted) {
                      setStatus("Listening...");
                      sourceNodesRef.current.forEach(n => { try { n.stop(); } catch(e){} });
                      sourceNodesRef.current.clear();
                      nextStartTimeRef.current = 0;
                      return;
                  }
                  
                  // Handle Audio
                  const inlineData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData;
                  if (inlineData?.data) {
                      setStatus("Speaking...");
                      const binaryString = atob(inlineData.data);
                      const len = binaryString.length;
                      const bytes = new Uint8Array(len);
                      for (let i = 0; i < len; i++) {
                          bytes[i] = binaryString.charCodeAt(i);
                      }
                      const int16 = new Int16Array(bytes.buffer);
                      const floats = new Float32Array(int16.length);
                      for (let i = 0; i < int16.length; i++) {
                          floats[i] = int16[i] / 32768.0;
                      }
                      
                      const buffer = outputCtx.createBuffer(1, floats.length, 24000);
                      buffer.getChannelData(0).set(floats);
                      
                      const source = outputCtx.createBufferSource();
                      source.buffer = buffer;
                      source.connect(outputCtx.destination);
                      
                      const now = outputCtx.currentTime;
                      // Ensure we don't schedule in the past
                      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
                      source.start(nextStartTimeRef.current);
                      nextStartTimeRef.current += buffer.duration;
                      
                      sourceNodesRef.current.add(source);
                      source.onended = () => {
                          sourceNodesRef.current.delete(source);
                          if (sourceNodesRef.current.size === 0) setStatus("Listening...");
                      };
                  }
              },
              onerror: (e) => {
                  console.error(e);
                  setStatus("Error");
              },
              onclose: () => {
                  setStatus("Disconnected");
              }
            }
        });
        
        sessionRef.current = sessionPromise;
      } catch (err) {
          console.error(err);
          setStatus("Failed to Start");
      }
    };

    startSession();

    return () => {
        isActive = false;
        clearInterval(videoInterval);
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (sessionRef.current) sessionRef.current.then((s: any) => s.close());
        if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-void-900 flex flex-col items-center justify-center">
       <div className="absolute inset-0 overflow-hidden">
         <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-30 scale-110 blur-sm" />
         <div className="absolute inset-0 bg-gradient-to-t from-void-900 via-transparent to-void-900"></div>
       </div>
       <div className="z-10 w-full max-w-md p-8 text-center space-y-6 animate-fade-in relative">
           <div className="relative inline-block">
               {/* Pulse Effect based on volume */}
               <div className="absolute inset-0 bg-red-500 rounded-full blur-2xl opacity-20" style={{ transform: `scale(${1 + volume/100})` }}></div>
               <Activity className={`relative z-10 transition-colors duration-300 ${status === 'Speaking...' ? 'text-neon-cyan' : 'text-red-500'}`} size={64} strokeWidth={1.5} />
           </div>
           <div>
               <h2 className="text-3xl font-black text-white tracking-tight mb-2">Live Tutor</h2>
               <p className={`font-mono text-sm uppercase tracking-widest transition-colors ${status === 'Speaking...' ? 'text-neon-cyan animate-pulse' : 'text-red-400'}`}>{status}</p>
           </div>
           
           <div className="h-2 bg-void-800 rounded-full overflow-hidden w-full max-w-[200px] mx-auto mt-4 border border-white/10">
               <div className="h-full bg-red-500 transition-all duration-100 ease-out" style={{ width: `${Math.min(100, volume)}%` }}></div>
           </div>

           <button onClick={onClose} aria-label="End Session" className="group relative px-8 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full font-bold border border-red-500/50 transition-all overflow-hidden mt-8">
               <span className="relative z-10 group-hover:text-red-100 transition-colors">End Session</span>
               <div className="absolute inset-0 bg-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
           </button>
       </div>
    </div>
  );
};

// --- Drawing Canvas ---
const DrawingCanvas: React.FC<{ onAnalyze: (data: string) => void }> = ({ onAnalyze }) => {
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
      <div className="h-64 bg-gray-50 dark:bg-void-800 rounded-2xl border border-gray-200 dark:border-white/10 relative overflow-hidden shadow-inner">
          <canvas ref={canvasRef} className="w-full h-full cursor-crosshair touch-none"
            onMouseDown={(e) => { canvasRef.current?.getContext('2d')?.beginPath(); start(e); }}
            onMouseUp={stop} onMouseMove={draw}
            onTouchStart={(e) => { canvasRef.current?.getContext('2d')?.beginPath(); start(e); }}
            onTouchEnd={stop} onTouchMove={draw}
          />
          <div className="absolute bottom-3 right-3 flex gap-2">
             <button onClick={clear} aria-label="Clear Canvas" className="p-2 bg-white/80 dark:bg-void-900/80 text-gray-800 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition"><XCircle size={16}/></button>
             <button onClick={() => onAnalyze(canvasRef.current?.toDataURL('image/jpeg') || '')} aria-label="Analyze Drawing" className="px-4 py-2 bg-neon-cyan text-black rounded-lg hover:brightness-110 transition font-bold text-xs flex items-center gap-2">
                <Zap size={14} fill="currentColor" /> Analyze Sketch
             </button>
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
  
  // Unified Sidebar State: controls visibility for both mobile (slide) and desktop (collapse)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>({ dyslexicFont: false, readingRuler: false, aslAvatar: false, highContrast: false });
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(false);
  
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
  const speechRecognitionRef = useRef<any>(null);

  // Responsive Sidebar Initialization
  useEffect(() => {
    // Default to closed on mobile, open on desktop
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

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

  // UPDATED: Convert all uploads to JPEG Data URL via Canvas to ensure Veo compatibility and handle max size
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                
                // Max size logic
                const MAX_SIZE = 1024;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Standardize to JPEG to avoid MIME type mismatch issues in Gemini/Veo
                    setInputImage(canvas.toDataURL('image/jpeg', 0.9));
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    }
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
     // Fallback to MediaRecorder if STT is not used or supported
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

  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    // Explicitly handle STT if available
    if (SpeechRecognition) {
       if (isRecording) {
           // Stop recording
           setIsRecording(false);
           if (speechRecognitionRef.current) {
               speechRecognitionRef.current.stop();
           }
       } else {
           // Start recording
           const recognition = new SpeechRecognition();
           recognition.lang = 'en-US';
           recognition.continuous = false; // Capture one complete sentence/phrase then stop for robustness
           recognition.interimResults = false; 
           recognition.maxAlternatives = 1;

           recognition.onstart = () => {
               setIsRecording(true);
           };

           recognition.onend = () => {
               setIsRecording(false);
           };

           recognition.onerror = (event: any) => {
               setIsRecording(false);
               console.error("Speech Recognition Error:", event.error);
               // If STT fails, we want to fallback gracefully if possible, or just alert.
               // For now, simpler to alert or just stop to avoid confusion.
               if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                   alert("Microphone access denied or service unavailable. Using audio attachment mode.");
               }
               // Fallback attempt: if API fails, try direct audio recording next time
               // But here, we just stop to reset state.
           };

           recognition.onresult = (event: any) => {
               const transcript = event.results[0][0].transcript;
               if (transcript) {
                   setInputText(prev => (prev + ' ' + transcript).trim());
               }
           };

           speechRecognitionRef.current = recognition;
           try {
              recognition.start();
           } catch (e) {
               console.error(e);
               setIsRecording(false);
               // Instant fallback if start fails
               toggleRecording();
           }
       }
    } else {
        // Fallback to recording audio attachment if API not supported
        toggleRecording();
    }
  };

  // Reset functionality
  const handleReset = () => {
      setIsProcessing(false);
      setCurrentSessionId(null);
      setInputText('');
      setInputImage(null);
      setRecordedAudio(null);
      setInputHypothesis('');
      // Optional: stop active speech if any (simple implementation)
      window.speechSynthesis.cancel();
  };

  // Modified startQuest to accept overrides for instant sketch analysis
  const startQuest = async (inputOverrides?: { text?: string, image?: string, audio?: string }) => {
    // EASTER EGG CHECK
    if (inputText.toLowerCase().includes('show me the future')) {
        setShowTrailer(true);
        return;
    }

    const textToUse = inputOverrides?.text ?? inputText;
    const imageToUse = inputOverrides?.image ?? inputImage;
    const audioToUse = inputOverrides?.audio ?? recordedAudio;

    if (!textToUse && !imageToUse && !audioToUse) return;
    if (!apiKeyReady) { await selectApiKey(); setApiKeyReady(true); }
    setIsProcessing(true);
    
    const newSession: QuestSession = {
      id: crypto.randomUUID(),
      inputs: { 
          text: textToUse, 
          image: imageToUse?.split(',')[1], 
          audio: audioToUse || undefined, 
          hypothesis: inputHypothesis 
      },
      isVideoLoading: false, isViralLoading: false, chatHistory: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);

    try {
      const result = await analyzeQuestInputs(newSession.inputs.text, newSession.inputs.image, newSession.inputs.audio, newSession.inputs.hypothesis);
      
      const hasGeo = !!navigator.geolocation;
      
      setSessions(prev => prev.map(s => s.id === newSession.id ? { 
          ...s, 
          result, 
          isSearchLoading: true, 
          isMapLoading: hasGeo,
          videoConfig: { prompt: result.videoPrompt, aspectRatio: '16:9', useInputImage: !!newSession.inputs.image } 
      } : s));

      generateNarration(result.explanation).then(audioUrl => setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, generatedAudioUrl: audioUrl } : s)));
      
      fetchRealTimeData(result.title)
          .then(data => setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, isSearchLoading: false, result: { ...s.result!, searchData: data } } : s)))
          .catch(() => setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, isSearchLoading: false } : s)));
      
      if (hasGeo) {
           navigator.geolocation.getCurrentPosition(
               pos => {
                   fetchMapData(result.title, pos.coords.latitude, pos.coords.longitude)
                       .then(data => setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, isMapLoading: false, result: { ...s.result!, mapData: data } } : s)))
                       .catch(() => setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, isMapLoading: false } : s)));
               },
               () => {
                   setSessions(prev => prev.map(s => s.id === newSession.id ? { ...s, isMapLoading: false } : s));
               }
           );
      }
      
      // Clear inputs only if not using overrides (or clear anyway to be safe)
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

  const handleDrawingAnalyze = (imageData: string) => {
      setInputImage(imageData);
      startQuest({ image: imageData });
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const hasResult = !!currentSession?.result;

  if (showIntro) return <ConstellationVisualizer onSkip={() => setShowIntro(false)} />;
  if (showTrailer) return <TrailerOverlay onClose={() => setShowTrailer(false)} />;
  if (showThumbnail) return <ThumbnailView onClose={() => setShowThumbnail(false)} />;
  if (isLiveMode) return <LiveTutorMode onClose={() => setIsLiveMode(false)} />;

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'dark' : ''} ${accessibility.highContrast ? 'contrast-150' : ''} bg-gray-50 dark:bg-void-900 text-gray-900 dark:text-gray-100 h-[100dvh]`}>
      {accessibility.readingRuler && <div className="reading-ruler" style={{ top: '50%' }} />}
      <video ref={smartMonitorVideoRef} className="hidden" muted />
      
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        
        {/* Sidebar - Responsive Logic */}
        <div className={`
            fixed md:relative z-30 h-full transition-all duration-300 ease-in-out
            bg-white dark:bg-void-800 border-r border-gray-200 dark:border-white/5 flex flex-col shadow-2xl md:shadow-none
            ${isSidebarOpen ? 'translate-x-0 w-80' : '-translate-x-full w-0 md:translate-x-0 md:w-0 md:overflow-hidden'}
        `}>
            <div className="p-6 border-b border-gray-200 dark:border-white/5 flex justify-between items-center min-w-[20rem]">
                <h2 className="text-xl font-bold text-gradient">My Quests</h2>
                {/* Mobile close button */}
                <button onClick={() => setIsSidebarOpen(false)} aria-label="Close Sidebar" className="md:hidden p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-w-[20rem]">
                {sessions.map(s => (
                    <div key={s.id} onClick={() => { setCurrentSessionId(s.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`p-4 rounded-xl cursor-pointer transition-all border group ${s.id === currentSessionId ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-white/5 border-transparent'}`}>
                        <div className={`font-semibold truncate ${s.id === currentSessionId ? 'text-neon-cyan' : 'text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white'}`}>{s.result?.title || "Thinking..."}</div>
                        <div className="text-xs text-gray-500 mt-1">{new Date(s.result?.timestamp || Date.now()).toLocaleDateString()}</div>
                    </div>
                ))}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-white/5 space-y-1 min-w-[20rem]">
                 <button onClick={() => setShowThumbnail(true)} aria-label="Generate Thumbnail" className="flex items-center space-x-3 text-sm text-gray-400 hover:text-neon-green w-full p-2 transition-colors">
                     <LayoutTemplate size={18} /> <span>📸 Thumbnail</span>
                 </button>
                 <button onClick={() => setShowSettings(!showSettings)} aria-label="Toggle Accessibility" className="flex items-center space-x-3 text-sm text-gray-400 hover:text-neon-cyan w-full p-2 transition-colors">
                     <Accessibility size={18} /> <span>Accessibility</span>
                 </button>
                 {showSettings && (
                     <div className="bg-gray-100 dark:bg-void-900/50 p-3 rounded-lg text-xs space-y-2 border border-gray-200 dark:border-white/5 animate-fade-in">
                         {Object.entries(accessibility).map(([k,v]) => (
                             <label key={k} className="flex items-center space-x-2 cursor-pointer text-gray-700 dark:text-gray-300">
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
        <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-gray-50 dark:bg-void-900 transition-colors duration-500">
            <header className="h-20 border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-6 bg-white/90 dark:bg-void-900/90 backdrop-blur-md z-20 shrink-0 shadow-sm">
                <div className="flex items-center space-x-4">
                    {/* Toggle Sidebar Button (Desktop & Mobile) */}
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-gray-400 transition-colors">
                        <PanelLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 cursor-pointer select-none" onClick={handleReset}>
                        <span className="text-gray-800 dark:text-white">Gemini</span><span className="text-neon-cyan">Quest</span>
                        <Sparkles className="text-neon-purple animate-pulse-slow" size={16} />
                    </h1>
                </div>
                <div className="flex items-center space-x-4">
                    <button onClick={() => setIsLiveMode(true)} aria-label="Start Live Mode" className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full text-xs font-bold border border-red-500/30 transition-all animate-pulse">
                         <Radio size={16} /> <span>LIVE</span>
                    </button>
                    <button onClick={handleReset} aria-label="New Quest" className="flex items-center space-x-2 px-5 py-2.5 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 rounded-full font-bold text-sm transition-all shadow-[0_0_10px_rgba(0,242,255,0.1)] hover:shadow-[0_0_20px_rgba(0,242,255,0.2)]">
                        <RefreshCw size={16} /> <span className="hidden sm:inline">New Quest</span>
                    </button>
                    <button onClick={() => setShowChat(!showChat)} aria-label="Toggle Chat" className={`p-2.5 rounded-full transition-colors ${showChat ? 'bg-neon-purple text-white shadow-lg shadow-neon-purple/30' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                        <MessageCircle size={22} />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative">
                <div className="max-w-7xl mx-auto w-full pb-20">
                    <GamificationBar profile={profile} />
                    {!hasResult && !isProcessing && (
                        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-float">
                            <div className="w-full max-w-3xl glass-panel p-8 md:p-10 rounded-3xl space-y-8 shadow-2xl">
                                <h2 className="text-3xl md:text-4xl font-black text-center text-gray-900 dark:text-white mb-4 tracking-tight">What have you observed?</h2>
                                
                                {/* Segmented Control for Input Mode */}
                                <div className="flex justify-center p-1.5 bg-gray-100 dark:bg-void-900/60 rounded-xl w-full max-w-md mx-auto border border-gray-200 dark:border-white/5">
                                    {[
                                        { id: 'upload', icon: ImageIcon, label: 'Upload' },
                                        { id: 'camera', icon: Camera, label: 'Camera' },
                                        { id: 'draw', icon: PenTool, label: 'Draw' }
                                    ].map(m => (
                                        <button 
                                            key={m.id} 
                                            onClick={()=>setInputMode(m.id as any)} 
                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${inputMode===m.id ? 'bg-white dark:bg-void-700 text-neon-cyan shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5'}`}
                                        >
                                            <m.icon size={16} /> {m.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-6">
                                    <div className="w-full">
                                        {inputMode === 'upload' && (
                                            <button onClick={() => document.getElementById('file-upload')?.click()} className="h-64 w-full rounded-2xl bg-gray-50 dark:bg-void-800/30 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-neon-cyan dark:hover:border-neon-cyan hover:bg-gray-100 dark:hover:bg-void-800/50 group flex flex-col items-center justify-center transition-all overflow-hidden relative">
                                                {inputImage ? <img src={inputImage} alt="Preview" className="absolute inset-0 w-full h-full object-contain p-4" /> : <><div className="p-4 bg-white dark:bg-void-900 rounded-full mb-3 shadow-lg group-hover:scale-110 transition-transform"><ImageIcon className="text-gray-400 dark:text-gray-500 group-hover:text-neon-cyan transition-colors" size={32}/></div><span className="text-sm font-medium text-gray-500 dark:text-gray-400">Click to upload image</span></>}
                                            </button>
                                        )}
                                        {inputMode === 'camera' && (
                                            <button onClick={handleCameraCapture} className="h-64 w-full rounded-2xl bg-gray-50 dark:bg-void-800/30 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-neon-cyan dark:hover:border-neon-cyan hover:bg-gray-100 dark:hover:bg-void-800/50 group flex flex-col items-center justify-center transition-all overflow-hidden relative">
                                                 {inputImage ? <img src={inputImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" /> : <><div className="p-4 bg-white dark:bg-void-900 rounded-full mb-3 shadow-lg group-hover:scale-110 transition-transform"><Camera className="text-gray-400 dark:text-gray-500 group-hover:text-neon-cyan transition-colors" size={32}/></div><span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tap to snap photo</span></>}
                                            </button>
                                        )}
                                        {inputMode === 'draw' && ( <DrawingCanvas onAnalyze={handleDrawingAnalyze} /> )}
                                        <input type="file" id="file-upload" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                    </div>
                                    
                                    {inputImage && (
                                        <div className="flex items-center space-x-3 bg-gray-100 dark:bg-void-900/60 p-3 rounded-xl border border-gray-200 dark:border-white/10">
                                            <Sparkles size={18} className="text-neon-purple ml-2" />
                                            <input value={nanoPrompt} onChange={(e) => setNanoPrompt(e.target.value)} placeholder="Transform image style (e.g. 'cyberpunk')" className="flex-1 bg-transparent border-none text-sm focus:ring-0 text-gray-900 dark:text-white placeholder-gray-500" />
                                            <button onClick={handleNanoEdit} disabled={isNanoProcessing} className="px-5 py-2 bg-neon-purple/20 text-neon-purple border border-neon-purple/50 rounded-lg text-xs font-bold hover:bg-neon-purple/30 transition-colors">
                                                {isNanoProcessing ? '...' : 'Style'}
                                            </button>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <div className="relative group">
                                            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Describe what you see or ask a question..." className="w-full h-32 p-5 pr-16 rounded-xl bg-gray-100 dark:bg-void-800/50 border border-gray-200 dark:border-white/10 focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan resize-none transition-all text-gray-900 dark:text-white placeholder-gray-500 text-base" />
                                            {/* Audio recording feedback overlay */}
                                            {recordedAudio && (
                                                <div className="absolute top-4 right-4 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1 flex items-center gap-2 text-xs font-bold text-red-500 animate-fade-in z-10">
                                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                                    Voice Note Attached
                                                    <button onClick={() => setRecordedAudio(null)} className="ml-1 hover:text-red-700"><Trash2 size={12} /></button>
                                                </div>
                                            )}
                                            <button onClick={handleMicClick} aria-label={isRecording ? "Stop Listening" : "Start Listening"} className={`absolute bottom-4 right-4 p-3 rounded-xl transition-all shadow-lg ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-void-700 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-void-600'}`}><Mic size={22} /></button>
                                        </div>
                                        <input value={inputHypothesis} onChange={(e) => setInputHypothesis(e.target.value)} placeholder="(Optional) My hypothesis is..." className="w-full p-4 rounded-xl bg-gray-100 dark:bg-void-800/30 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:ring-0 transition-all" />
                                    </div>
                                </div>
                                <button onClick={() => startQuest()} aria-label="Launch Quest" className="w-full py-5 bg-gradient-to-r from-neon-cyan to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black uppercase tracking-wider rounded-xl text-xl shadow-[0_0_25px_rgba(0,242,255,0.4)] transition-all transform hover:scale-[1.01] flex items-center justify-center gap-3">
                                    <span>Launch Quest</span> <Send size={22} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                    )}

                    {isProcessing && <LoadingSpinner label="Analyzing Observation..." onCancel={handleReset} />}

                    {hasResult && currentSession && currentSession.result && (
                        <div className="space-y-8 animate-fade-in">
                            {/* Header Section for Result */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/60 dark:bg-void-800/30 p-4 rounded-2xl border border-gray-200 dark:border-white/5 backdrop-blur">
                                <div>
                                     <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">{currentSession.result.title}</h2>
                                     <div className="flex items-center gap-3 mt-2">
                                         <span className="bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/20">Confidence: {currentSession.result.confidenceScore}%</span>
                                         <span className="text-gray-500 text-xs">{new Date(currentSession.result.timestamp).toLocaleDateString()}</span>
                                     </div>
                                </div>
                                <div className="flex space-x-3 shrink-0">
                                    <button onClick={handleReset} className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold border border-red-500/20 transition-all">
                                        <RefreshCw size={16} /> <span>Refresh Quest</span>
                                    </button>
                                    <button onClick={() => setSmartMonitorEnabled(!smartMonitorEnabled)} aria-label="Toggle Smart Monitor" className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${smartMonitorEnabled ? 'bg-neon-green/10 text-neon-green border border-neon-green/30' : 'bg-gray-200 dark:bg-void-700 text-gray-500 dark:text-gray-400 border border-transparent'}`}>
                                        <Eye size={16} /> <span>Smart Monitor</span>
                                    </button>
                                    {currentSession.generatedAudioUrl && (
                                        <button className="p-3 bg-neon-cyan/10 rounded-xl text-neon-cyan hover:bg-neon-cyan/20 transition-colors border border-neon-cyan/20">
                                            <Music size={20} /> <audio autoPlay src={currentSession.generatedAudioUrl} className="hidden" />
                                        </button>
                                    )}
                                    {currentSession.generatedVideoUrl && (
                                        <button onClick={() => handleExportViral(currentSession)} className="p-3 bg-pink-500/10 rounded-xl text-pink-500 hover:bg-pink-500/20 transition-colors border border-pink-500/20" title="Export Viral Clip">
                                            {currentSession.isViralLoading ? <div className="animate-spin w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full"/> : <Share2 size={20} />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Visuals Row - Side by Side */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-auto lg:h-[450px]">
                                {/* Veo Video Section */}
                                <div className="glass-panel p-1 rounded-3xl overflow-hidden relative flex flex-col group h-[400px] lg:h-full shadow-2xl">
                                    <div className="flex-1 relative bg-black/50 overflow-hidden rounded-2xl">
                                        {currentSession.isVideoLoading ? <LoadingSpinner label="Simulating (Veo)..." /> : 
                                          currentSession.generatedVideoUrl ? (
                                              <video src={currentSession.generatedVideoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                                          ) : <VideoPlaceholder />
                                        }
                                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-bold text-white border border-white/20 flex items-center gap-1.5 pointer-events-none">
                                            <Video size={12} className="text-neon-purple"/> Veo Studio
                                        </div>
                                    </div>
                                    {!currentSession.generatedVideoUrl && !currentSession.isVideoLoading && (
                                        <div className="p-4 space-y-3 bg-white dark:bg-void-900/90 border-t border-gray-200 dark:border-white/5">
                                            <textarea value={currentSession.videoConfig?.prompt || ''} onChange={(e) => setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, videoConfig: { ...s.videoConfig!, prompt: e.target.value } } : s))} className="w-full bg-gray-100 dark:bg-void-800 text-gray-800 dark:text-gray-300 text-xs p-3 rounded-xl border border-gray-200 dark:border-white/10 h-16 resize-none focus:border-neon-purple focus:ring-0 transition-colors" placeholder="Describe simulation..." />
                                            <div className="flex justify-between items-center">
                                                <div className="flex space-x-2 bg-gray-100 dark:bg-void-800 rounded-lg p-1">
                                                    {['16:9', '9:16'].map(ratio => (
                                                        <button key={ratio} onClick={() => setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, videoConfig: { ...s.videoConfig!, aspectRatio: ratio as any } } : s))} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${currentSession.videoConfig?.aspectRatio===ratio ? 'bg-white dark:bg-void-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{ratio}</button>
                                                    ))}
                                                </div>
                                                <button onClick={() => handleGenerateVideo(currentSession)} className="px-5 py-2 bg-gradient-to-r from-neon-purple to-pink-600 text-white text-xs font-bold rounded-lg hover:brightness-110 shadow-lg shadow-neon-purple/20 transition-all flex items-center gap-2">
                                                    <PlayCircle size={14} /> Simulate
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Chart Section */}
                                <div className="glass-panel rounded-3xl p-8 flex flex-col h-[400px] lg:h-full relative overflow-hidden">
                                     <div className="absolute top-0 right-0 p-6 opacity-5 dark:opacity-10 pointer-events-none">
                                        <Activity size={100} className="text-neon-cyan" />
                                     </div>
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10"><Activity size={16} className="text-neon-cyan" />{currentSession.result.visualTitle}</h3>
                                    <div className="flex-1 w-full min-h-0 relative z-10">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={currentSession.result.visualData}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} stroke={darkMode ? "#fff" : "#000"} />
                                                <XAxis dataKey="label" stroke={darkMode ? "#6b7280" : "#9ca3af"} tick={{fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                                                <YAxis stroke={darkMode ? "#6b7280" : "#9ca3af"} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#fff', borderRadius: '12px', border: '1px solid rgba(128,128,128,0.1)', color: darkMode ? '#fff' : '#000', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} itemStyle={{ color: '#00f2ff' }} cursor={{fill: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}} />
                                                <Bar dataKey="value" fill="url(#colorGradient)" radius={[6, 6, 0, 0]}>
                                                    {currentSession.result.visualData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#00f2ff' : '#bd00ff'} fillOpacity={0.8} /> ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Content Grid (2/3 + 1/3) */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Column: Narrative & Details */}
                                <div className="lg:col-span-2 space-y-8">
                                    <div className="glass-panel rounded-3xl p-8 md:p-10 space-y-8 relative">
                                        {accessibility.aslAvatar && (
                                            <div className="absolute top-8 right-8 w-32 h-32 border-2 border-neon-cyan rounded-2xl overflow-hidden bg-black z-10 shadow-[0_0_20px_rgba(0,242,255,0.3)] animate-fade-in hidden md:block">
                                                <img src="https://media.giphy.com/media/l41lFj8af6V5n5tLi/giphy.gif" alt="ASL Signer" className="w-full h-full object-cover opacity-90" />
                                                <div className="absolute bottom-0 w-full bg-black/80 text-[8px] font-bold tracking-widest text-center text-white py-1">ASL INTERPRETER</div>
                                            </div>
                                        )}
                                        
                                        <div className="prose prose-lg max-w-none prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-loose prose-headings:text-gray-900 dark:prose-headings:text-white prose-strong:text-neon-cyan">
                                            <p>{currentSession.result.explanation}</p>
                                        </div>
                                        
                                        {/* Citations */}
                                        <div className="flex flex-wrap gap-2 pt-6 border-t border-gray-200 dark:border-white/5">
                                            {currentSession.result.citations?.map((c,i) => <span key={i} className="bg-gray-100 dark:bg-void-900 text-gray-500 dark:text-gray-400 px-3 py-1 rounded-full text-xs border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20 transition-colors cursor-help max-w-[300px] truncate flex items-center gap-1"><Globe size={10} />{c}</span>)}
                                        </div>

                                        {/* Reasoning Accordion */}
                                        <details className="group bg-gray-50 dark:bg-void-900/40 rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
                                            <summary className="list-none cursor-pointer flex items-center justify-between p-4 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-neon-purple hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                                                <span className="flex items-center gap-2"><Sparkles size={16} /> Analysis & Reasoning Chain</span>
                                                <ChevronRight className="group-open:rotate-90 transition-transform" size={16} /> 
                                            </summary>
                                            <div className="p-6 pt-0 text-gray-600 dark:text-gray-400 font-mono text-xs leading-relaxed border-t border-gray-200 dark:border-white/5 mt-2">
                                                <div className="pt-4">{currentSession.result.reasoningSummary}</div>
                                            </div>
                                        </details>
                                    </div>
                                    
                                    {/* Grounding Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="glass-panel p-6 rounded-2xl border-l-4 border-blue-500 bg-white dark:bg-gradient-to-br dark:from-void-800 dark:to-void-900/50 hover:bg-gray-50 dark:hover:bg-void-800 transition-colors">
                                            <h4 className="font-bold flex items-center space-x-2 text-blue-500 dark:text-blue-400 mb-4"><Search size={18}/> <span>Latest Research</span></h4>
                                            {currentSession.isSearchLoading ? (
                                                <GroundingSkeleton />
                                            ) : (
                                                <div className="space-y-4">
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-4">{currentSession.result.searchData?.summary}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {currentSession.result.searchData?.sources.slice(0,2).map((s, i) => (
                                                            <a key={i} href={s.uri} target="_blank" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-300 px-2 py-1.5 rounded hover:bg-blue-500/20 transition truncate max-w-[200px] flex items-center gap-1"><ArrowRight size={10} />{s.title}</a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="glass-panel p-6 rounded-2xl border-l-4 border-green-500 bg-white dark:bg-gradient-to-br dark:from-void-800 dark:to-void-900/50 hover:bg-gray-50 dark:hover:bg-void-800 transition-colors">
                                            <h4 className="font-bold flex items-center space-x-2 text-green-500 dark:text-green-400 mb-4"><MapPin size={18}/> <span>Local Context</span></h4>
                                            {currentSession.isMapLoading ? (
                                                <GroundingSkeleton />
                                            ) : (
                                                <div className="space-y-4">
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-4">{currentSession.result.mapData?.summary}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {currentSession.result.mapData?.links.slice(0,2).map((s, i) => (
                                                            <a key={i} href={s.uri} target="_blank" className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-300 px-2 py-1.5 rounded hover:bg-green-500/20 transition truncate max-w-[200px] flex items-center gap-1"><ArrowRight size={10} />{s.title}</a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Sidebar (Quiz & Next Steps) */}
                                <div className="space-y-8">
                                    <div className="glass-panel rounded-3xl p-6 md:p-8 bg-gradient-to-br from-white to-gray-50 dark:from-void-800 dark:to-indigo-900/20 border-t border-indigo-500/20 shadow-xl">
                                        <h3 className="text-sm font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Trophy size={18} /> Knowledge Check</h3>
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
                                     <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-2">Continue Your Journey</h3>
                                        {currentSession.result.nextQuestSuggestions.map((suggestion, idx) => (
                                            <button key={idx} onClick={() => { setInputText(suggestion); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full p-5 rounded-2xl bg-white dark:bg-void-800 border border-gray-200 dark:border-white/5 hover:border-neon-cyan/50 hover:bg-gray-50 dark:hover:bg-void-700 transition-all text-left group shadow-lg hover:shadow-neon-cyan/5">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-neon-cyan uppercase tracking-wider">Path {idx + 1}</span>
                                                    <ArrowRight size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-neon-cyan transform group-hover:translate-x-1 transition-all" />
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors line-clamp-2 leading-relaxed">{suggestion}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {showChat && (
                    <div className="w-full md:w-80 bg-white dark:bg-void-800 border-l border-gray-200 dark:border-white/10 flex flex-col h-full absolute right-0 top-0 z-40 shadow-2xl animate-fade-in">
                        <div className="p-4 border-b border-gray-200 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-void-900/50 backdrop-blur-sm">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Sparkles size={14} className="text-neon-purple"/> AI Tutor</h3>
                            <button onClick={() => setShowChat(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={16}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {currentSession?.chatHistory?.length === 0 && <div className="text-center text-gray-500 text-sm mt-10">Ask me anything about this quest!</div>}
                            {currentSession?.chatHistory?.map((msg, i) => (
                                <div key={i} className={`p-3 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-neon-cyan/10 text-neon-cyan ml-4 border border-neon-cyan/20' : 'bg-gray-100 dark:bg-void-700 text-gray-700 dark:text-gray-200 mr-4 border border-gray-200 dark:border-white/5'}`}>{msg.text}</div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-void-900/50 backdrop-blur-sm">
                            <div className="flex gap-2">
                                <input className="flex-1 bg-white dark:bg-void-950 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white focus:border-neon-purple focus:ring-0 transition-colors" placeholder="Type a message..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSend()} />
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

// ... QuizComponent remains unchanged ...
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
            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Quest Complete!</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">You earned <span className="text-neon-cyan font-bold">{score * 50} XP</span></p>
        </div>
    );

    const q = questions[currentQ];
    return (
        <div className="space-y-4">
            <div className="flex justify-between text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                <span>Question {currentQ + 1} / {questions.length}</span>
                <span>Score: {score}</span>
            </div>
            <p className="font-semibold text-gray-800 dark:text-white leading-relaxed">{q.question}</p>
            <div className="space-y-2">
                {q.options.map((opt, idx) => {
                    let btnClass = "w-full p-3 rounded-lg text-left text-sm transition-all border ";
                    if (showFeedback) {
                        if (idx === q.correctIndex) btnClass += "bg-green-500/20 border-green-500/50 text-green-600 dark:text-green-300";
                        else if (idx === selected) btnClass += "bg-red-500/20 border-red-500/50 text-red-600 dark:text-red-300";
                        else btnClass += "bg-gray-100 dark:bg-void-950 border-transparent opacity-40 text-gray-500";
                    } else {
                        btnClass += "bg-white dark:bg-void-950 border-gray-200 dark:border-white/5 hover:border-neon-cyan/50 hover:bg-gray-50 dark:hover:bg-void-900 text-gray-700 dark:text-gray-300";
                    }
                    return <button key={idx} onClick={() => handleAnswer(idx)} className={btnClass}>{opt}</button>
                })}
            </div>
            {showFeedback && (
                <div className="pt-3 animate-fade-in">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 bg-gray-100 dark:bg-void-950 p-3 rounded-lg border border-gray-200 dark:border-white/5">{q.explanation}</div>
                    <button onClick={nextQuestion} className="w-full py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                        {currentQ < questions.length - 1 ? "Next Question" : "Collect XP"}
                    </button>
                </div>
            )}
        </div>
    );
};