import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { messageId, rating } = await req.json();
    if (!messageId || !rating) {
      return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    await supabase.from('feedback').insert({
      message_id: messageId,
      rating,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
