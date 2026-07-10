import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.linexmedya.crm',
  appName: 'Linex CRM',
  webDir: 'out',
  server: {
    url: 'https://linex-crm.vercel.app',
    cleartext: true
  }
};

export default config;
