import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

export type KineticCaptionsProps = {
  words: string[];
  framesPerWord: number;
  fontSize: number;
  textColor: string;
  highlightColor: string;
  highlightTextColor: string;
  background: string;
};

export const kineticCaptionsDefaults: KineticCaptionsProps = {
  words: 'Small fixes make the whole world feel brand new'.split(' '),
  framesPerWord: 15,
  fontSize: 84,
  textColor: '#FFFFFF',
  highlightColor: '#FFD23F',
  highlightTextColor: '#111111',
  background: 'linear-gradient(160deg,#1b1f3a,#3a1c4a)',
};

// Word-by-word captions: each word pops in with a spring; the active word is highlighted.
// Lines wrap on their own inside a 960px column (fits 1080 wide).
export const KineticCaptions: React.FC<KineticCaptionsProps> = ({words, framesPerWord, fontSize, textColor, highlightColor, highlightTextColor, background}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{background, justifyContent: 'center', alignItems: 'center', fontFamily: 'DejaVu Sans, sans-serif'}}>
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 20, rowGap: 30, maxWidth: 960}}>
        {words.map((w, i) => {
          const start = i * framesPerWord + 10;
          const s = spring({frame: f - start, fps, config: {damping: 12, stiffness: 200}});
          const active = f >= start && f < start + framesPerWord;
          const op = interpolate(f, [start, start + 3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <span key={i} style={{
              fontSize, fontWeight: 900, color: active ? highlightTextColor : textColor,
              background: active ? highlightColor : 'transparent', padding: '4px 18px', overflowWrap: 'anywhere', borderRadius: 18,
              transform: `scale(${0.6 + 0.4 * s}) translateY(${(1 - s) * 40}px)`, opacity: op,
              textShadow: active ? 'none' : '0 6px 0 rgba(0,0,0,.35)',
            }}>{w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
