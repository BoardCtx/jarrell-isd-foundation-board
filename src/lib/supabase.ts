import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export const createClient = () =>
  createClientComponentClient<Database>();

export const createServerClient = () =>
  createServerComponentClient<Database>({ cookies });
