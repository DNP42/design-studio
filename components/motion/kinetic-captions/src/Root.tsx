import React from 'react';
import {Composition} from 'remotion';
import {KineticCaptions, kineticCaptionsDefaults} from './KineticCaptions';

export const Root: React.FC = () => (
  <Composition
    id="kinetic-captions"
    component={KineticCaptions}
    fps={30}
    width={1080}
    height={1920}
    durationInFrames={180}
    defaultProps={kineticCaptionsDefaults}
    calculateMetadata={({props}) => ({durationInFrames: props.words.length * props.framesPerWord + 45})}
  />
);
