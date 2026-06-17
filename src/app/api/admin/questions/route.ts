import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

function validateToken(authHeader: string | null): { id: string } | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.slice(7);
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// List frequent questions
export async function GET(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');

  const { data } = await supabase
    .from('frequent_questions')
    .select('*')
    .order('count', { ascending: false })
    .limit(limit);

  return NextResponse.json({ questions: data || [] });
}

// Update answer for a frequent question
export async function PUT(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id, answer } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  await supabase
    .from('frequent_questions')
    .update({ answer })
    .eq('id', id);

  return NextResponse.json({ success: true });
}

// Delete a frequent question
export async function DELETE(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  await supabase.from('frequent_questions').delete().eq('id', id);

  return NextResponse.json({ success: true });
}
