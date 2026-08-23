import React from 'react';
import { GlassSurface } from './GlassSurface';
import { radius } from '../theme/glass';

export function GlassCard(props: React.ComponentProps<typeof GlassSurface>) {
  return <GlassSurface {...props} />;
}

export { radius };
