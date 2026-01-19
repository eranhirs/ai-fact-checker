
// import { GoogleGenAI, Type } from "@google/genai";
// import { SourceDocument, VerificationResult } from '../types';

// const STORAGE_KEY = 'gemini_api_key';

// export const getStoredApiKey = (): string => {
//   return localStorage.getItem(STORAGE_KEY) || '';
// };

// export const setStoredApiKey = (apiKey: string): void => {
//   localStorage.setItem(STORAGE_KEY, apiKey);
// };

// export const verifyClaimWithGemini = async (
//   claim: string,
//   sources: SourceDocument[],
//   apiKey?: string
// ): Promise<VerificationResult> => {
//   const key = apiKey || getStoredApiKey() || process.env.API_KEY || '';

//   if (!key) {
//     throw new Error("No API key configured. Please set your Gemini API key in settings.");
//   }

//   const ai = new GoogleGenAI({ apiKey: key });
  
//   if (!claim) throw new Error("No claim provided");
//   if (sources.length === 0) throw new Error("No sources provided");

//   const validSources = sources.filter(s => s.status === 'fetched');
  
//   if (validSources.length === 0) {
//     return {
//       status: 'inconclusive',
//       evidence: [],
//       explanation: "Could not fetch content from any source URLs."
//     };
//   }

//   // Construct the prompt context
//   const sourcesText = validSources.map((s, index) => 
//     `SOURCE ${index + 1} (${s.url}):\n${s.content}\n---`
//   ).join('\n');

//   const prompt = `
//     You are a rigorous fact-checking assistant. 
//     User Claim: "${claim}"
    
//     Below are the contents of several web pages cited as attribution.
//     Your task is to search these sources for EXACT text that supports the claim.
    
//     ${sourcesText}
    
//     Instructions:
//     1. Analyze the sources to find sentences that directly support the claim.
//     2. If found, extract the exact quote and the URL of the source it came from.
//     3. Determine if the claim is "supported", "unsupported" (contradicted), "partial" (some parts supported, others not), or "inconclusive" (not found in sources).
//     4. Provide a brief explanation.
//   `;

//   try {
//     const response = await ai.models.generateContent({
//       model: 'gemini-3-pro-preview',
//       contents: prompt,
//       config: {
//         responseMimeType: "application/json",
//         responseSchema: {
//           type: Type.OBJECT,
//           properties: {
//             status: { 
//               type: Type.STRING, 
//               enum: ['supported', 'unsupported', 'partial', 'inconclusive'],
//               description: "The verification status of the claim."
//             },
//             evidence: {
//               type: Type.ARRAY,
//               items: { 
//                 type: Type.OBJECT,
//                 properties: {
//                   quote: { type: Type.STRING, description: "The exact quote from the source." },
//                   sourceUrl: { type: Type.STRING, description: "The URL of the source where the quote was found." }
//                 },
//                 required: ['quote', 'sourceUrl']
//               },
//               description: "Exact quotes and their source URLs supporting the verification status."
//             },
//             explanation: {
//               type: Type.STRING,
//               description: "A concise explanation of the findings."
//             }
//           },
//           required: ['status', 'evidence', 'explanation']
//         }
//       }
//     });

//     const resultText = response.text;
//     if (!resultText) throw new Error("Empty response from Gemini");

//     return JSON.parse(resultText) as VerificationResult;

//   } catch (error) {
//     console.error("Gemini Verification Error:", error);
//     return {
//       status: 'inconclusive',
//       evidence: [],
//       explanation: "An error occurred while communicating with the AI verification service."
//     };
//   }
// };
