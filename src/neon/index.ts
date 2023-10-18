import { createApiClient } from '@neondatabase/api-client';
import { input } from '../input';

export const neon = createApiClient({apiKey: input.neonApiToken})