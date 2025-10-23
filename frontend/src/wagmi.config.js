import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'LS-LMSR Prediction Market',
  projectId: '9a65b54a9cd89df934f3269520b35ba3', 
  chains: [baseSepolia],
  ssr: false, 
});