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

The English word appears large and is spoken once.

Practice shows the German word. You type the English one. Spots keeps the words from that moment until you write them correctly.

Glasses puts the same word in a lens. Swipe is a sentence from the freeze. Web flips a few words on a page into English. All three use the same rehearsed words, so the pitch can show those paths.

The home screen plays two short clips. In each clip, someone answers a question, loses a word, and uses Conversation Copilot.

## Run it

```bash
npm install
npm run dev
```

Open the local address the command prints.

## What is in the repo

- Home explains the product and plays the two clips.
- Live is the microphone. Next word offers cozy from the café line.
- Practice asks you to type the English word.
- Spots lists what is still open.
- Glasses, Swipe, and Web show the same three words in those places.

There is no account, no backend, and no API key. The browser listens. The three spoken English words are audio files in `public/whisper`.
