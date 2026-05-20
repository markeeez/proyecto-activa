import { useContext } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { ThemeContext } from '@/context/ThemeContext';

export function useColorScheme(): 'light' | 'dark' {
  const ctx = useContext(ThemeContext);
  const systemScheme = useRNColorScheme();
  if (ctx != null) {
    return ctx.isDark ? 'dark' : 'light';
  }
  return systemScheme ?? 'dark';
}
