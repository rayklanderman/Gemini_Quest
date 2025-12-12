import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { QuestResult } from "../types";

// Helper to check for API key selection
export const checkApiKey = async (): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    return hasKey;
  }
  return true; 
};

export const selectApiKey = async (): Promise<void> => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
    }
}

// Helper to sanitize JSON strings (remove markdown code blocks)
const cleanJson = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned;
};

// 1. Analyze Inputs (Text + Image + Audio) -> Structured JSON
export const analyzeQuestInputs = async (
  text: string | undefined,
  imageBase64: string | undefined,
  audioBase64: string | undefined,
  hypothesis: string | undefined
): Promise<QuestResult> => {

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [];
  
  if (text) parts.push({ text: `Observation: ${text}` });
  if (hypothesis) parts.push({ text: `User Hypothesis/Notes: ${hypothesis}` });
  if (imageBase64) {
    parts.push({
      inlineData: { mimeType: 'image/jpeg', data: imageBase64 }
    });
  }
  if (audioBase64) {
    parts.push({
        inlineData: { mimeType: 'audio/webm', data: audioBase64 } 
    });
  }

  // Enhanced Schema
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "A catchy title for this science quest" },
      explanation: { type: Type.STRING, description: "A comprehensive, easy-to-understand explanation. If the user provided a hypothesis, analyze it here." },
      videoPrompt: { type: Type.STRING, description: "A detailed visual description to generate a 5-second educational video about this concept using Veo. Ensure it is safe, scientific, and visually clear." },
      reasoningSummary: { type: Type.STRING, description: "A summary of the step-by-step scientific reasoning used to reach this conclusion." },
      visualTitle: { type: Type.STRING, description: "Title for a data chart." },
      visualType: { type: Type.STRING, enum: ["bar", "pie", "line"] },
      visualData: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            value: { type: Type.NUMBER }
          }
        }
      },
      nextQuestSuggestions: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      quiz: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING }
          }
        }
      },
      citations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of scientific papers or credible sources."
      },
      confidenceScore: {
        type: Type.NUMBER,
        description: "Scientific confidence score between 0 and 100."
      }
    },
    required: ["title", "explanation", "videoPrompt", "quiz", "nextQuestSuggestions", "reasoningSummary", "visualData", "citations", "confidenceScore"]
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
        role: 'user',
        parts: parts
    },
    config: {
      systemInstruction: "You are an expert science tutor. Analyze the provided inputs (text, images, sketches, audio). If a sketch or diagram is provided (e.g. physics force diagram, biology cell structure), interpret the handwriting and drawings to solve the problem or explain the concept step-by-step. Identify the scientific phenomenon. Generate a structured response. If a hypothesis is provided, critique it constructively. Ensure the 'videoPrompt' is purely educational, scientific, safe for all audiences, and describes a clear visual scene.",
      responseMimeType: "application/json",
      responseSchema: responseSchema
    }
  });

  const jsonText = cleanJson(response.text || "{}");
  try {
    const data = JSON.parse(jsonText) as QuestResult;
    data.id = crypto.randomUUID();
    data.timestamp = Date.now();
    return data;
  } catch (e) {
    console.error("Failed to parse JSON", e, jsonText);
    throw new Error("Failed to process quest results. Please try again.");
  }
};

// 2. Nano Banana: Edit Image
export const editImageWithNano = async (imageBase64: string, instruction: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: instruction }
      ]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/jpeg;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated by Nano Banana");
};

// 3. Generate Audio Narration
export const generateNarration = async (text: string): Promise<string> => {
  const narrationText = text.length > 500 ? text.substring(0, 500) + "..." : text;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: narrationText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  return `data:audio/mp3;base64,${base64Audio}`;
};

// 4. Generate Explainer Video (Veo 3) with Advanced Controls
export const generateExplainerVideo = async (
    prompt: string, 
    aspectRatio: '16:9' | '9:16' = '16:9',
    inputImageBase64?: string
): Promise<string> => {
  // Capture key at call time
  const currentKey = process.env.API_KEY; 
  const ai = new GoogleGenAI({ apiKey: currentKey });
  
  // Construct request dynamically to avoid undefined properties
  const request: any = {
    model: 'veo-3.1-fast-generate-preview', 
    prompt: `${prompt}`,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio
    }
  };

  if (inputImageBase64) {
      request.image = {
          imageBytes: inputImageBase64,
          mimeType: 'image/jpeg'
      };
  }

  let operation = await ai.models.generateVideos(request);

  // Polling loop with 10s delay (Veo recommended)
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000)); 
    operation = await ai.operations.getVideosOperation({ operation });
  }

  // Extra safety delay to ensure CDN propagation
  await new Promise(resolve => setTimeout(resolve, 2000));

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video generation failed: No URI returned.");

  // Fetch the video content using the API key and convert to a Blob URL
  const separator = videoUri.includes('?') ? '&' : '?';
  const urlWithKey = `${videoUri}${separator}key=${currentKey}`;
  
  try {
      console.log("Attempting to fetch video blob...");
      const response = await fetch(urlWithKey);
      if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      // Explicitly set MIME type to ensure browser playback compatibility
      const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      console.log("Video blob created successfully");
      return blobUrl;
  } catch (e) {
      console.warn("Video fetch failed (likely CORS), falling back to direct URL", e);
      // Fallback: Return the direct URL. 
      // This is a robust backup if CORS blocks the fetch in the browser.
      return urlWithKey;
  }
};

// 5. Smart Monitor: Detect Emotion
export const detectUserEmotion = async (imageBase64: string): Promise<{ isConfused: boolean; advice: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const schema: Schema = {
      type: Type.OBJECT,
      properties: {
          isConfused: { type: Type.BOOLEAN },
          advice: { type: Type.STRING }
      },
      required: ["isConfused", "advice"]
  };
  
  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
          role: 'user',
          parts: [
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
              { text: "Analyze the user's facial expression in this webcam frame. Are they looking confused, frowning, or frustrated? Return JSON." }
          ]
      },
      config: {
          responseMimeType: "application/json",
          responseSchema: schema
      }
  });
  
  try {
      const jsonText = cleanJson(response.text || "{}");
      return JSON.parse(jsonText);
  } catch {
      return { isConfused: false, advice: "" };
  }
};

// 6. Real-Time Search (Grounding)
export const fetchRealTimeData = async (query: string): Promise<{ summary: string, sources: any[] }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find the latest scientific news and research papers regarding: ${query}. Summarize key findings.`,
        config: {
            tools: [{ googleSearch: {} }]
        }
    });

    const summary = response.text || "No recent updates found.";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((c: any) => c.web ? { title: c.web.title, uri: c.web.uri } : null)
        .filter((x: any) => x) || [];

    return { summary, sources };
};

// 7. Map Insights (Maps Grounding)
export const fetchMapData = async (query: string, lat?: number, lng?: number): Promise<{ summary: string, links: any[] }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find scientific points of interest, ecosystems, or relevant locations near me related to: ${query}`,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: lat && lng ? {
                retrievalConfig: { latLng: { latitude: lat, longitude: lng } }
            } : undefined
        }
    });

    const summary = response.text || "No local insights found.";
    // Map grounding chunks logic (simplified extraction)
    const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((c: any) => c.web ? { title: c.web.title, uri: c.web.uri } : null) // Maps tool often returns web links too or map URIs in chunks
        .filter((x: any) => x) || [];
    
    return { summary, links };
};

// 8. Chat Agent
export const chatWithAgent = async (history: any[], newMessage: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const chat = model.startChat({
        history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
        systemInstruction: "You are a helpful science tutor. Use Socratic method to guide the user."
    });
    const result = await chat.sendMessage(newMessage);
    return result.response.text();
};