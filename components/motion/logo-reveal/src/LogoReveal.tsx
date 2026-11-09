import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Easing, spring, useVideoConfig} from 'remotion';

export type LogoRevealProps = {
  text: string;
  background: string;
  letterColor: string;
  underlineColor: string;
  fontSize: number;
  underlineWidth: number;
};

export const logoRevealDefaults: LogoRevealProps = {
  text: 'LOGO',
  background: '#0e0e10',
  letterColor: '#FFD23F',
  underlineColor: '#FFFFFF',
  fontSize: 260,
  underlineWidth: 640,
};

// Anticipation (squash + pull back), overshoot (spring), settle; letters staggered 4 frames.
export const LogoReveal: React.FC<LogoRevealProps> = ({text, background, letterColor, underlineColor, fontSize, underlineWidth}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  // anticipation 0-12f: squash to 0.7 (never below 0.6), widen, ease-in
  const antic = interpolate(f, [0, 12], [1, 0.7], {easing: Easing.in(Easing.cubic), extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background, justifyContent: 'center', alignItems: 'center', fontFamily: 'DejaVu Sans, sans-serif'}}>
      <div style={{display: 'flex', gap: 20}}>
        {text.split('').map((ch, i) => {
          const start = 12 + i * 4;
          const s = spring({frame: f - start, fps, config: {damping: 9, stiffness: 160, mass: 0.9}});
          const pull = f < start ? interpolate(f, [0, start], [0, 70], {extrapolateRight: 'clamp'}) : 0;
          const y = f < start ? pull : (1 - s) * -400;
          const sy = f < start ? antic : 0.6 + 0.4 * s;
          const sx = f < start ? 2 - antic : 1 + (1 - s) * 0.3;
          return (
            <div key={i} style={{
              fontSize, fontWeight: 900, color: letterColor,
              transform: `translateY(${y}px) scale(${sx},${Math.max(sy, 0.6)})`,
              transformOrigin: '50% 100%', opacity: f < start ? 0.25 : 1,
            }}>{ch === ' ' ? '\u00a0' : ch}</div>
          );
        })}
      </div>
      <div style={{
        position: 'absolute', bottom: 640, height: 12, borderRadius: 6, background: underlineColor,
        width: interpolate(f, [50, 75], [0, underlineWidth], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)}),
      }} />
    </AbsoluteFill>
  );
};
