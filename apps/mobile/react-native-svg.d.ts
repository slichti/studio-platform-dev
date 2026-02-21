/**
 * Minimal type stub for react-native-svg.
 * lucide-react-native depends on this package for SvgProps,
 * but it is provided at runtime via Expo SDK and not listed
 * as a direct dependency. This stub satisfies TypeScript.
 */
declare module 'react-native-svg' {
  import { ComponentType } from 'react';

  export interface SvgProps {
    width?: number | string;
    height?: number | string;
    viewBox?: string;
    preserveAspectRatio?: string;
    color?: string;
    stroke?: string;
    strokeWidth?: number | string;
    strokeLinecap?: 'butt' | 'round' | 'square';
    strokeLinejoin?: 'miter' | 'round' | 'bevel';
    fill?: string;
    fillOpacity?: number | string;
    fillRule?: 'nonzero' | 'evenodd';
    opacity?: number | string;
    style?: object;
    className?: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }

  const Svg: ComponentType<SvgProps>;
  export default Svg;
  export { Svg };
}
