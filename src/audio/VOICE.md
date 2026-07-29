# Host voice production

The app ships five local MP3 files. If one is missing, the asset generator can
create a deterministic silent placeholder, never synthetic fallback speech.
Replace placeholders at the exact paths below before the live game. Runtime
playback is entirely local and simply skips a cue when its file is silent or
cannot decode.

## Casting note

Use one consistent male voice across all five recordings. A deep, conventional
villain voice announces the threat and flattens the character. The Host is
frightening because he is genial and pleased with himself while describing
something lethal.

## Script 1 - cold-open

File: `public/audio/voice/cold-open.mp3`
Pin: 1
Planned duration: approximately 22 seconds

Replace `[NAME]` with the player's first name.

> There you are. I've been waiting since it got dark.
> Happy birthday, [NAME]. Thirty-three. I do love a round number, and that isn't one, which makes it so much more interesting.
> Everything you need is in the flat. Everything. Do keep up.
> The last one didn't.

Direction: A gracious host greeting a guest he has anticipated all day. Warm,
unhurried, smiling, and slightly too familiar. No menace in the delivery. The
last sentence is quieter and more affectionate, as though sharing something
amusing. Never raise the voice.

## Script 2 - tape

File: `public/audio/voice/tape.mp3`
Pin: 12
Planned duration: approximately 75 seconds

> This was the last one. I want you to watch, because he watched too, and it did him no good at all.
> He sat where you sat. He asked the same question. He asked it for quite a long time.
> He was clever. Not clever enough to look behind him. But clever.
> He found things. He was very good at finding things. That was rather the problem.
> I decorated. Nobody ever thanks me for the decorating.
> And he took the candle. They always take the candle. It is the only thing in the room that looks like a way out.
> And then he read this. Five letters. He said it out loud, which I thought was brave.
> Happy birthday, [NAME]. Do better than he did.

Direction: Narrate a home video of a holiday he genuinely enjoyed. Fond,
nostalgic, mildly amused, and conversational. Leave a clear one-second pause
between paragraphs. Slow down and go quieter across the last two paragraphs.
No theatrical villainy, growl, or whisper. The horror is that he finds this
pleasant.

## Script 3 - draught

File: `public/audio/voice/draught.mp3`
Pin: 23
Planned duration: approximately 16 seconds

> Oh, that is unfortunate.
> That happened to him too, you know. Almost exactly there. He said a word I shan't repeat.
> Off you go. It will still be lit when you come back. Probably.

Direction: Delighted. He waited for this and it just happened. Quick, light,
gleeful, and almost laughing. Faster than his other lines. This is the one time
he is openly pleased about her failure, so let it be genuinely funny to him.

## Script 4 - trophy

File: `public/audio/voice/trophy.mp3`
Pin: 26
Planned duration: approximately 20 seconds

> Oh.
> You did it.
> I did not think you would. I have done this a number of times now, and nobody has ever put the candle down still lit.
> Happy birthday. I mean it, which is new for me.
> Go on. Blow it out. It's yours.

Direction: The performance drops completely. Quiet, genuinely surprised, then
simply sincere. No smile in the voice, theatricality, or character. Leave a long
pause after the first word. Almost too plain. Slow.

## Script 5 - present

File: `public/audio/voice/present.mp3`
Pin: 28
Planned duration: approximately 14 seconds

> One more thing.
> I told you I would not tell you what was in it, and I will not, because you are about to find out and I would much rather watch.
> Thirty-three. What a number.
> Many happy returns.

Direction: Warm and fond, with the character back but no longer hostile. Deliver
it like a toast at the end of a long evening. Land the final line gently and
stop.

## Export and replacement

Export MP3 at 44.1 kHz, mono, and dry with no added reverb. The app routes voice
through the current zone's convolution reverb so the Host occupies the room the
player is standing in.

Replace a placeholder at its exact public path, then run:

```text
node scripts/generate-audio-assets.mjs
node scripts/generate-audio-assets.mjs --check
node scripts/report-voice-audio.mjs
```

The generator preserves a non-placeholder MP3, verifies MPEG Layer III, mono,
and 44.1 kHz, then records its measured metadata in `manifest.json`. Confirm the
report labels every final recording `production audio`.

## Tape synchronization

The tape screen starts the `tape` cue with `startVoice("tape")` and uses the
returned playback handle as its clock. Image cue fractions belong to the tape
module, not the audio manifest. Persisted claim state in gameplay prevents the
same Host line from being claimed twice across remounts or reloads.
