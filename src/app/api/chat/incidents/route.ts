import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Public endpoint - fetches active incidents for chat alerts
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('additional_items')
      .select('id, title, description, expires_at, created_at')
      .eq('category', 'incidentes')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching incidents:', error);
      return NextResponse.json({ incidents: [] });
    }

    return NextResponse.json({ incidents: data || [] });
  } catch (error) {
    console.error('Incidents API error:', error);
    return NextResponse.json({ incidents: [] });
  }
}
