
import { GoogleGenAI } from "@google/genai";
import { DesignStyle, AspectRatio, GroundingLink } from "../types";

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

export interface ImagePart {
  data: string;
  mimeType: string;
}

export interface PlaceContextResponse {
  text: string;
  links: GroundingLink[];
}

export class GeminiService {
  private static getCurrentKey(): string {
    const key = process.env.API_KEY;
    if (!key || key === "undefined" || key.trim() === "") return "";
    return key;
  }

  /**
   * Use Gemini 2.5 with Google Maps tool to get location-aware context.
   */
  static async getPlaceContext(prompt: string, location: { latitude: number; longitude: number }): Promise<PlaceContextResponse> {
    const key = this.getCurrentKey();
    if (!key) throw new Error("API key required for maps grounding.");

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-latest",
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: location.latitude,
                longitude: location.longitude
              }
            }
          }
        },
      });

      const text = response.text || "";
      const links: GroundingLink[] = [];
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.maps) {
            links.push({
              title: chunk.maps.title || "عرض على الخريطة",
              uri: chunk.maps.uri
            });
          }
        });
      }

      return { text, links };
    } catch (error: any) {
      console.error("Maps Grounding Error:", error);
      throw new Error("فشل الحصول على بيانات المكان: " + error.message);
    }
  }

  static async enhancePrompt(userPrompt: string, style: DesignStyle, hasImage: boolean, extraContext?: string): Promise<string> {
    const key = this.getCurrentKey();
    if (!key) return userPrompt;

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const instruction = `You are a professional visual prompt engineer. Style: ${style}. 
        ${hasImage ? "Enhance based on reference." : "Create from scratch."} 
        ${extraContext ? `Incorporate this geographic context: ${extraContext}` : ""}
        Translate Arabic to English. Focus on composition, lighting, and high-quality artistic terms.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `User Input: "${userPrompt}"`,
        config: {
          systemInstruction: instruction,
        },
      });
      return response.text?.trim() || userPrompt;
    } catch (error) {
      console.warn("Prompt enhancement failed, using original.", error);
      return userPrompt;
    }
  }

  static async generateImage(
    prompt: string, 
    style: DesignStyle, 
    ratio: AspectRatio, 
    highQuality: boolean,
    referenceImage?: ImagePart,
    seed?: number
  ): Promise<string> {
    const modelName = highQuality ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
    const key = this.getCurrentKey();

    if (!key) {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
      }
      throw new Error("يجب تفعيل مفتاح API أولاً.");
    }

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const contents: any[] = [{ text: prompt }];
      
      if (referenceImage) {
        contents.unshift({
          inlineData: {
            data: referenceImage.data,
            mimeType: referenceImage.mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: contents },
        config: {
          seed: seed,
          imageConfig: {
            aspectRatio: ratio as any,
            ...(highQuality ? { imageSize: "1K" as const } : {})
          }
        }
      });

      const candidate = response.candidates?.[0];
      if (!candidate || !candidate.content || !candidate.content.parts) {
        throw new Error("لم يتم تلقي استجابة صالحة تحتوي على أجزاء.");
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      
      throw new Error("الاستجابة لا تحتوي على بيانات صورة.");
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found") || error.message?.includes("API key not valid")) {
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
          throw new Error("انتهت صلاحية الجلسة. يرجى اختيار المفتاح مجدداً.");
        }
      }
      throw new Error(error.message || "فشل التصميم.");
    }
  }
}
