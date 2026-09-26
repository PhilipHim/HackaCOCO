# Conversation Copilot

You are mid-conversation. You know the word, and under pressure it is gone. You still have it in German. Hold the microphone, say that German word, and only the English word comes back. You say the English word yourself.

This repository is the pitch demo for Monad Blitz Berlin. The microphone knows three German words. Any other word is ignored, and the screen stays quiet.

## Try it

Use Chrome. That is the browser that can hear the microphone.

1. Open the site and go to Live.
2. Hold the microphone, or hold the space bar.
3. Say one of these, then let go:

- gemütlich → cozy
- erschöpft → exhausted
- unterbrechen → interrupt

The English word appears large and is spoken once. Practice keeps the words from this session, so you can hear them again.

The home screen plays two short clips. In each clip, someone answers a question, loses a word, and uses Conversation Copilot.

## Run it

```bash
npm install
npm run dev
```

Open the local address the command prints.

## What is in the repo

- Home explains the product and plays the two clips.
- Live is the microphone.
- Practice lists the words from the session.

There is no account, no backend, and no API key. The browser listens. The three spoken English words are audio files in `public/whisper`.
