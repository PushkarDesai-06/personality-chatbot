# Persona Chatbot

Minimal persona-based chat experience with three Scaler/InterviewBit personalities.

## Features

- Persona switcher that resets the conversation
- Suggestion chips section per persona
- Typing indicator and timestamps
- Responsive layout for mobile and desktop

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and add your key:

   ```bash
   cp .env.example .env.local
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

Open http://localhost:3000 in your browser.

## Configuration

- `GEMINI_API_KEY` in `.env.local` is required for the chat API.
- Update `prompts.md` with persona system prompts.
- Add your reflection to `reflection.md` before submission.

## Deploy (Vercel)

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Add `GEMINI_API_KEY` to Environment Variables.
4. Deploy.
