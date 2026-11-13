import React from 'react';
import {Composition} from 'remotion';
import {LogoReveal, logoRevealDefaults} from './LogoReveal';

export const Root: React.FC = () => (
  <Composition id="logo-reveal" component={LogoReveal} durationInFrames={120} fps={30} width={1080} height={1920} defaultProps={logoRevealDefaults} />
);
