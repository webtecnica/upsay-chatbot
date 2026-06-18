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

// List additional items
export async function GET(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const category = req.nextUrl.searchParams.get('category') || '';

  let query = supabase
    .from('additional_items')
    .select('*');

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data || [] });
}

// Create new additional item
export async function POST(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { category, title, description, expires_at } = await req.json();

  if (!category || !title || !description) {
    return NextResponse.json({ error: 'Categoria, título e descrição são obrigatórios' }, { status: 400 });
  }

  const validCategories = ['incidentes', 'avisos', 'melhorias', 'recomendacoes'];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 });
  }

  // Incidentes requerem data de expiração
  if (category === 'incidentes' && !expires_at) {
    return NextResponse.json({ error: 'Incidentes requerem data/hora de expiração' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const insertData: Record<string, unknown> = {
    category,
    title,
    description,
    is_active: true,
  };

  if (expires_at) {
    insertData.expires_at = expires_at;
  }

  const { data, error } = await supabase
    .from('additional_items')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}

// Update additional item
export async function PUT(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id, category, title, description, expires_at, is_active } = await req.json();

  if (!id || !title || !description) {
    return NextResponse.json({ error: 'ID, título e descrição são obrigatórios' }, { status: 400 });
  }

  // Incidentes requerem data de expiração
  if (category === 'incidentes' && !expires_at) {
    return NextResponse.json({ error: 'Incidentes requerem data/hora de expiração' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const updateData: Record<string, unknown> = {
    title,
    description,
    is_active: is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (category) updateData.category = category;
  if (expires_at !== undefined) updateData.expires_at = expires_at;

  const { data, error } = await supabase
    .from('additional_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

// Delete additional item
export async function DELETE(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  await supabase.from('additional_items').delete().eq('id', id);

  return NextResponse.json({ success: true });
}
