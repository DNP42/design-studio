# kinetic-captions

Word-by-word captions for 9:16 video (Remotion, id `kinetic-captions`, 1080x1920, 30 fps).
Each word pops in with a spring. The active word gets a highlight pill. Lines wrap by themselves.

## Use when
You need animated captions from a list of words. Timing is fixed per word, not from audio.

## Props
| Prop | Type | Default |
|---|---|---|
| `words` | string[] | `Small fixes make the whole world feel brand new` (9 words) |
| `framesPerWord` | number | `15` |
| `fontSize` | number (px) | `84` |
| `textColor` | CSS colour | `#FFFFFF` |
| `highlightColor` | CSS colour | `#FFD23F` |
| `highlightTextColor` | CSS colour | `#111111` |
| `background` | CSS background | `linear-gradient(160deg,#1b1f3a,#3a1c4a)` |

Length: `words.length * framesPerWord + 45` frames. Text wraps in a 960 px column. Above 84 px a long line may crowd the edges.

## Run
In a scratch directory, copy `src/`, then:
```bash
npm i
npx remotion still index.ts kinetic-captions ../poster.png --frame=170   # stills first (30, 75, 170)
npx remotion render index.ts kinetic-captions ../out.mp4 --codec=h264
```
Override props: add `--props='{"words":["Hello","there","world"],"highlightColor":"#3DDC97"}'`.

## Tested
Remotion + @remotion/cli 4.0.539, React 18.3.1, Node 22, ffmpeg 7.1.5. Rendered 2026-11-09. Score 4/5.

## Source
Prototype and notes: `~/art-lab/research/05-animation/motion/recipes/kinetic-captions/`.
