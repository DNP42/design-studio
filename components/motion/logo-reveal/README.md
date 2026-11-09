# logo-reveal

Brand-free intro/outro for 9:16 video (Remotion, id `logo-reveal`, 1080x1920, 30 fps, 4 s).
Letters squash, drop in with a spring overshoot, then an underline wipes in.

## Use when
You need a short logo or title sting. Pass your own text and colours. No brand is fixed.

## Props
| Prop | Type | Default |
|---|---|---|
| `text` | string | `LOGO` |
| `background` | CSS colour | `#0e0e10` |
| `letterColor` | CSS colour | `#FFD23F` |
| `underlineColor` | CSS colour | `#FFFFFF` |
| `fontSize` | number (px) | `260` |
| `underlineWidth` | number (px) | `640` |

More than 4 letters: lower `fontSize` to stay inside 1080 px.

## Run
In a scratch directory, copy `src/`, then:
```bash
npm i
npx remotion still index.ts logo-reveal ../poster.png --frame=100   # stills first (8, 20, 100)
npx remotion render index.ts logo-reveal ../out.mp4 --codec=h264
```
Override props: add `--props='{"text":"ACME","letterColor":"#3DDC97"}'`.

## Tested
Remotion + @remotion/cli 4.0.539, React 18.3.1, Node 22, ffmpeg 7.1.5. Rendered 2026-11-09. Score 4.5/5.

## Source
Prototype and notes: `~/art-lab/research/05-animation/motion/recipes/logo-reveal/`.
