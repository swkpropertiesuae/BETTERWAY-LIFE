'use client';

import { useEffect, useState } from 'react';
import '@/estate-os/styles/tokens.css';
import '@/estate-os/styles/base.css';
import '@/estate-os/styles/components.css';
import '@/estate-os/styles/motion.css';
import '@/estate-os/styles/assistant.css';
import '@/estate-os/styles/integrations.css';
import App from '@/estate-os/App';
import { installCardSpotlight } from '@/estate-os/lib/motion';
import { useStore } from '@/estate-os/store/store';

export function EstateOsHost({ userEmail }: { userEmail?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('estate-os:theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      document.documentElement.dataset.theme = savedTheme;
    } else if (!document.documentElement.dataset.theme) {
      document.documentElement.dataset.theme = 'light';
    }
    if (userEmail) {
      useStore.getState().setActiveEmail(userEmail);
    }
    installCardSpotlight();
    setMounted(true);
  }, [userEmail]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#eef1f5] text-[#0b1f3a] text-sm font-medium">
        Loading Betterway Mortgages OS…
      </div>
    );
  }

  return <App />;
}
