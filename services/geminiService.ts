
import { GoogleGenAI } from "@google/genai";
import { DesignStyle, AspectRatio } from "../types";

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

export class GeminiService {
  /**
   * الحصول على المفتاح الحالي من البيئة.
   * نتعامل مع حالات كونه undefined كمتغير أو "undefined" كنص ناتج عن Vite.
   */
  private static getCurrentKey(): string {
    const key = process.env.API_KEY;
    if (!key || key === "undefined" || key.trim() === "") return "";
    return key;
  }

  static async enhancePrompt(userPrompt: string, style: DesignStyle, hasImage: boolean): Promise<string> {
    const key = this.getCurrentKey();
    if (!key) return userPrompt;

    try {
      // إنشاء نسخة جديدة لكل طلب لضمان استخدام أحدث مفتاح (قاعدة أساسية)
      const ai = new GoogleGenAI({ apiKey: key });
      const instruction = `You are a professional visual prompt engineer. Style: ${style}. 
        ${hasImage ? "Enhance based on reference." : "Create from scratch."} 
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
      // إذا لم يوجد مفتاح، نحاول فتح نافذة الاختيار إذا كانت مدعومة
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
      }
      throw new Error("يجب تفعيل مفتاح API أولاً. يرجى النقر على زر 'تفعيل الخدمة' في الأعلى.");
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
      if (!candidate) throw new Error("لم يتم تلقي استجابة من الموديل.");

      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      
      throw new Error("الاستجابة لا تحتوي على بيانات صورة صالحة.");
    } catch (error: any) {
      // التعامل مع انتهاء صلاحية المفتاح أو الخطأ في الكيان
      if (error.message?.includes("Requested entity was not found") || error.message?.includes("API key not valid")) {
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
          throw new Error("انتهت صلاحية الجلسة. يرجى اختيار المفتاح مجدداً والمحاولة.");
        }
      }
      throw new Error(error.message || "فشل التصميم. يرجى المحاولة لاحقاً.");
    }
  }
}
