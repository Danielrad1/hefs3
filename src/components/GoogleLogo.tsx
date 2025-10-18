import React from 'react';
import { Image } from 'react-native';

interface GoogleLogoProps {
  size?: number;
}

/**
 * Official Google "G" logo from local assets
 */
export function GoogleLogo({ size = 20 }: GoogleLogoProps) {
  return (
    <Image 
      source={require('../../assets/Google__G__logo.svg.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
