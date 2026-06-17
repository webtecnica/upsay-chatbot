import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

// Change password
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const user = validateToken(authHeader);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Senhas obrigatórias' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Nova senha deve ter no mínimo 6 caracteres' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, password_hash')
      .eq('id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, adminUser.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await supabase
      .from('admin_users')
      .update({ password_hash: newHash })
      .eq('id', user.id);

    return NextResponse.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

function validateToken(authHeader: string | null): { id: string; email: string; name: string } | null {
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
