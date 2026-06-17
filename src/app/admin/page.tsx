'use client';

import { useState, useEffect, useCallback } from 'react';

interface Stats {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  topQuestions: { question: string; count: number; answer: string | null }[];
  feedbackStats: { total: number; positive: number; negative: number };
  dailyCounts: Record<string, number>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/stats?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const satisfactionRate = stats?.feedbackStats.total
    ? Math.round((stats.feedbackStats.positive / stats.feedbackStats.total) * 100)
    : 0;

  const chartEntries = Object.entries(stats?.dailyCounts || {});
  const maxCount = Math.max(...chartEntries.map(([, v]) => v), 1);

  return (
    <div>
      <h1 className="admin-page-title">📊 Dashboard</h1>

      {/* Period filter */}
      <div className="period-filter">
        {[
          { value: '1d', label: 'Hoje' },
          { value: '7d', label: '7 dias' },
          { value: '30d', label: '30 dias' },
          { value: '90d', label: '90 dias' },
        ].map(p => (
          <button
            key={p.value}
            className={`period-btn ${period === p.value ? 'active' : ''}`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Carregando estatísticas...</p>
      ) : stats ? (
        <>
          {/* Stats cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-icon">💬</div>
              <div className="stat-card-value">{stats.totalConversations}</div>
              <div className="stat-card-label">Conversas</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">📨</div>
              <div className="stat-card-value">{stats.totalMessages}</div>
              <div className="stat-card-label">Mensagens</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">🪙</div>
              <div className="stat-card-value">{(stats.totalTokens / 1000).toFixed(1)}k</div>
              <div className="stat-card-label">Tokens usados</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">😊</div>
              <div className="stat-card-value">{satisfactionRate}%</div>
              <div className="stat-card-label">Satisfação</div>
            </div>
          </div>

          {/* Chart */}
          {chartEntries.length > 0 && (
            <div className="chart-container">
              <h3>Mensagens por dia</h3>
              <div className="chart-bars">
                {chartEntries.map(([date, count]) => (
                  <div
                    key={date}
                    className="chart-bar"
                    style={{ height: `${(count / maxCount) * 100}%` }}
                    title={`${date}: ${count} mensagens`}
                  >
                    <span className="chart-bar-label">
                      {date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top questions */}
          <h3 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text-secondary)' }}>
            🔥 Top Perguntas Recorrentes
          </h3>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pergunta</th>
                  <th>Vezes</th>
                  <th>Resposta padrão</th>
                </tr>
              </thead>
              <tbody>
                {stats.topQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                      Nenhuma pergunta registrada ainda
                    </td>
                  </tr>
                ) : (
                  stats.topQuestions.map((q, i) => (
                    <tr key={i}>
                      <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.question}
                      </td>
                      <td>
                        <span className="count-badge">{q.count}</span>
                      </td>
                      <td>
                        {q.answer ? (
                          <span style={{ color: 'var(--success)', fontSize: '12px' }}>✅ Definida</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--danger)' }}>Erro ao carregar estatísticas</p>
      )}
    </div>
  );
}
