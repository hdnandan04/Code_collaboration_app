import { Router } from 'express';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import authMiddleware, { AuthRequest } from '../middleware/auth';

const router = Router();

// ---
// 1. Initialize the Google AI Client
// ---
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in .env file');
}

// Enforcing the type to prevent TypeScript/runtime initialization errors
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY! as string);

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ---
// 2. POST /api/ai/chat
// ---
router.post('/chat', authMiddleware, async (req: AuthRequest, res) => {
  // --- ⬇️ THIS IS THE FIX ⬇️ ---
  // We must default chatHistory to an empty array if it's undefined
  const { codeContext, language, chatHistory = [], prompt } = req.body;
  // --- ⬆️ THIS IS THE FIX ⬆️ ---

  // This log will prove the new code is running
  console.log(`✅ Received /api/ai/chat request. History length: ${chatHistory.length}`);

  if (!prompt) {
    return res.status(400).json({ message: 'A prompt is required' });
  }

  const systemPrompt = `
    You are an expert AI pair programmer, like GitHub Copilot.
    You are assisting a user who is writing ${language} code.

    The user's *entire code file* is provided below for context:
    --- CODE CONTEXT START ---
    ${codeContext || '(No code provided)'}
    --- CODE CONTEXT END ---

    Your task is to answer the user's prompts.
    - Be concise and helpful.
    - If the user asks you to write or fix code, provide only the code block in a markdown format.
    - If the user asks to explain code, provide a clear explanation.
    - Use the provided code context to give the most relevant answers.
  `;

  try {
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
        {
          role: 'model',
          parts: [{ text: 'OK, I am ready to help.' }],
        },
        // This spread is now safe because chatHistory defaults to []
        ...chatHistory,
      ],
      generationConfig: {
        maxOutputTokens: 2000,
      },
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    
    // Added safety check for blocked/empty responses
    const aiMessage = response.text ? response.text() : 'Sorry, I had trouble generating a response. Please try again.';

    res.json({ aiResponse: aiMessage });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ message: 'Error generating AI response' });
  }
});

export default router;