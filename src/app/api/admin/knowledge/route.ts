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

// List knowledge chunks
export async function GET(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;
  const search = req.nextUrl.searchParams.get('search') || '';
  const source = req.nextUrl.searchParams.get('source') || '';

  let query = supabase
    .from('knowledge_chunks')
    .select('id, title, content, section, source, created_at, updated_at', { count: 'exact' });

  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }
  if (source) {
    query = query.eq('source', source);
  }

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return NextResponse.json({
    chunks: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

// Add new knowledge
export async function POST(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { title, content, section } = await req.json();
  if (!title || !content) {
    return NextResponse.json({ error: 'Título e conteúdo são obrigatórios' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('knowledge_chunks')
    .insert({ title, content, section: section || 'Manual', source: 'admin' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chunk: data }, { status: 201 });
}

// Update knowledge
export async function PUT(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id, title, content, section } = await req.json();
  if (!id || !title || !content) {
    return NextResponse.json({ error: 'ID, título e conteúdo são obrigatórios' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('knowledge_chunks')
    .update({ title, content, section, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chunk: data });
}

// Delete knowledge
export async function DELETE(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  await supabase.from('knowledge_chunks').delete().eq('id', id);

  return NextResponse.json({ success: true });
}
