# Host voice production

## Casting note

Male voice throughout, one consistent voice across all five, primary choice `ballad`, fallbacks `ash` then `verse`. Avoid `onyx` unless `ballad` proves too light: a deep menacing voice announces the threat and flattens the character. The Host is frightening because he is genial and pleased with himself while describing something lethal.

## Script 1 — cold-open

File: `public/audio/voice/cold-open.mp3`
Pin: 1
Placeholder: approximately 22 seconds

Replace `[NAME]` with the player's first name.

> There you are. I've been waiting since it got dark.
> Happy birthday, [NAME]. Thirty-three. I do love a round number, and that isn't one, which makes it so much more interesting.
> Everything you need is in the flat. Everything. Do keep up.
> The last one didn't.

instructions:

> Male voice. A gracious host greeting a guest he has been looking forward to all day. Warm, unhurried, smiling throughout. Slightly too familiar. No menace whatsoever in the delivery. On the final sentence, drop quieter and more affectionate, as though sharing something amusing rather than a threat. Never raise the voice.

## Script 2 — tape

File: `public/audio/voice/tape.mp3`
Pin: 12
Placeholder: approximately 75 seconds

> This was the last one. I want you to watch, because he watched too, and it did him no good at all.
> He sat where you sat. He asked the same question. He asked it for quite a long time.
> He was clever. Not clever enough to look behind him. But clever.
> He found things. He was very good at finding things. That was rather the problem.
> I decorated. Nobody ever thanks me for the decorating.
> And he took the candle. They always take the candle. It is the only thing in the room that looks like a way out.
> And then he read this. Five letters. He said it out loud, which I thought was brave.
> Happy birthday, [NAME]. Do better than he did.

instructions:

> Male voice. A man narrating a home video of a holiday he genuinely enjoyed. Fond, nostalgic, mildly amused, conversational. Leave a clear one second pause between paragraphs. Slow down and go quieter across the last two paragraphs. Absolutely no theatrical villainy, no growl, no whisper. The horror is that he finds this pleasant.

## Script 3 — draught

File: `public/audio/voice/draught.mp3`
Pin: 23
Placeholder: approximately 16 seconds

> Oh, that is unfortunate.
> That happened to him too, you know. Almost exactly there. He said a word I shan't repeat.
> Off you go. It will still be lit when you come back. Probably.

instructions:

> Male voice. Delighted. He has been waiting for this to happen and it just did. Quick, light, gleeful, almost laughing. Faster than his other lines. This is the only time he is openly pleased about her failing, so let it be genuinely funny to him.

## Script 4 — trophy

File: `public/audio/voice/trophy.mp3`
Pin: 26
Placeholder: approximately 20 seconds

> Oh.
> You did it.
> I did not think you would. I have done this a number of times now, and nobody has ever put the candle down still lit.
> Happy birthday. I mean it, which is new for me.
> Go on. Blow it out. It's yours.

instructions:

> Male voice. The performance drops completely. Quiet, genuinely surprised, then simply sincere. No smile in the voice, no theatricality, no character. Long pause after the first word. Almost too plain. Slow.

## Script 5 — present

File: `public/audio/voice/present.mp3`
Pin: 28
Placeholder: approximately 14 seconds

> One more thing.
> I told you I would not tell you what was in it, and I will not, because you are about to find out and I would much rather watch.
> Thirty-three. What a number.
> Many happy returns.

instructions:

> Male voice. Warm and fond, the character back on but no longer hostile. Delivered like a toast at the end of a long evening. Land the final line gently and stop.

## Export guidance

MP3, 44.1kHz, mono, dry with no added reverb, because the app routes voice through the current zone's convolution reverb so he sounds like he is in whichever room she is standing in.

Replace a placeholder at its exact public path and run `node scripts/generate-audio-assets.mjs`. The generator preserves a non-placeholder MP3, validates its first MPEG frame as mono 44.1 kHz, and compiles the bytes for URL-free offline playback. The runtime warns, but does not throw, while a silent placeholder remains.

## Tape image integration

Import `TAPE_IMAGE_CUE_SECONDS` from `src/audio/voiceCues.ts`. Its seven timestamps are provisional values derived from the 75-second placeholder and must be adjusted against the final performed waveform. The tape owner should start image timing from the same `say("tape")` playback start, not from an unrelated fixed timer. `AudioDirector` currently claims and fires that line when pin 12 resolves; coordinate that call when the tape screen is integrated so it is not restarted.
