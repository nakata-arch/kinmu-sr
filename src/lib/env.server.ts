import 'server-only';
import { z } from 'zod';

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

let cached: z.infer<typeof serverSchema> | null = null;

export function getServerEnv() {
  if (cached) return cached;
  cached = serverSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  return cached;
}
