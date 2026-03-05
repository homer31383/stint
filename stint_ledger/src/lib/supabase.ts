import { createClient } from '@supabase/supabase-js';
import type {
  StintClient,
  StintProject,
  StintTimeEntry,
  StintPencil,
  StintInvoice,
  StintSettings,
} from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function fetchStintData() {
  const [clients, projects, timeEntries, pencils, invoices, settingsArr] = await Promise.all([
    fetchAll<StintClient>('stint_clients'),
    fetchAll<StintProject>('stint_projects'),
    fetchAll<StintTimeEntry>('stint_time_entries'),
    fetchAll<StintPencil>('stint_pencils'),
    fetchAll<StintInvoice>('stint_invoices'),
    fetchAll<StintSettings>('stint_settings'),
  ]);

  return {
    clients,
    projects,
    timeEntries,
    pencils,
    invoices,
    settings: settingsArr[0] ?? null,
  };
}
