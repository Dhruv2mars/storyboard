import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY!);

export interface ImageGenerationResult {
  imageData: string; // Base64 encoded image data
  contentType: string;
  size: number;
}

export async function generateImage(imagePrompt: string): Promise<ImageGenerationResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-preview-image-generation",
      generationConfig: {
        responseModalities: ["Text", "Image"]
      }
    });

    const result = await model.generateContent(imagePrompt);
    const response = result.response;
    
    // Look for image data in the response
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          const contentType = part.inlineData.mimeType || "image/png";
          
          // Calculate size from base64 data
          const size = Math.floor((imageData.length * 3) / 4);
          
          return {
            imageData,
            contentType,
            size,
          };
        }
      }
    }

    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

export function estimateImageGenerationCost(): number {
  // Gemini 2.0 Flash image generation costs 3.9 cents per image
  return 0.039;
}

export function convertBase64ToBlob(base64Data: string, contentType: string): Blob {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export function createImageFile(base64Data: string, contentType: string, filename: string): File {
  const blob = convertBase64ToBlob(base64Data, contentType);
  return new File([blob], filename, { type: contentType });
}