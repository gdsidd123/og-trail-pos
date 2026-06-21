import 'dotenv/config';
import { ExpoConfig, ConfigContext } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'OG Trail POS',
  slug: config.slug ?? 'og-trail-pos',
  android: {
    ...config.android,
    package: config.android?.package ?? 'com.ogtrail.pos',
  },
  extra: {
    ...config.extra,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    eas: {
      ...(config.extra?.eas ?? {}),
      projectId: 'bd36e2a2-2fe7-4883-b9d6-ab13867adad7',
    },
  },
});
