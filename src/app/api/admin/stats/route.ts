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

export async function GET(req: NextRequest) {
  const user = validateToken(req.headers.get('authorization'));
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const period = req.nextUrl.searchParams.get('period') || '7d';

  let daysBack = 7;
  if (period === '1d') daysBack = 1;
  else if (period === '30d') daysBack = 30;
  else if (period === '90d') daysBack = 90;

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // Total conversations
  const { count: totalConversations } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);

  // Total messages
  const { count: totalMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);

  // Total tokens used
  const { data: tokenData } = await supabase
    .from('messages')
    .select('tokens_used')
    .gte('created_at', since)
    .eq('role', 'assistant');

  const totalTokens = (tokenData || []).reduce((sum, m) => sum + (m.tokens_used || 0), 0);

  // Top questions
  const { data: topQuestions } = await supabase
    .from('frequent_questions')
    .select('question, count, last_asked_at, answer')
    .order('count', { ascending: false })
    .limit(20);

  // Feedback stats
  const { data: feedbackData } = await supabase
    .from('feedback')
    .select('rating')
    .gte('created_at', since);

  const feedbackStats = {
    total: feedbackData?.length || 0,
    positive: feedbackData?.filter(f => f.rating >= 4).length || 0,
    negative: feedbackData?.filter(f => f.rating <= 2).length || 0,
  };

  // Daily message counts for chart
  const { data: dailyData } = await supabase
    .from('messages')
    .select('created_at')
    .eq('role', 'user')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  const dailyCounts: Record<string, number> = {};
  (dailyData || []).forEach(m => {
    const day = m.created_at.split('T')[0];
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });

  return NextResponse.json({
    totalConversations: totalConversations || 0,
    totalMessages: totalMessages || 0,
    totalTokens,
    topQuestions: topQuestions || [],
    feedbackStats,
    dailyCounts,
  });
}
