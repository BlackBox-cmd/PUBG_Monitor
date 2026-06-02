import 'dotenv/config';

interface Config {
  discord: {
    token: string;
    appId: string;
    footerText: string;
    activities: string[];
  };
  pubg: {
    apiKey: string;
  };
  uptimeKuma: {
    url?: string;
    interval: number;
  };
  mongodb: {
    uri: string;
  };
}

const config: Config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    appId: process.env.DISCORD_APP_ID || '',
    footerText: process.env.FOOTER_TEXT || 'PUBG Monitor | Made by Mr_Freak_cmd | v1.1.1',
    activities: (process.env.BOT_ACTIVITY || 'PUBG Matches').split(',').map(s => s.trim()),
  },
  pubg: {
    apiKey: process.env.PUBG_API_KEY || '',
  },
  uptimeKuma: {
    url: process.env.UPTIME_KUMA_URL,
    interval: parseInt(process.env.UPTIME_KUMA_INTERVAL || '30', 10),
  },
  mongodb: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/pubg',
  },
};

export default config;