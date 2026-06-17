'use client';

import { useState, useEffect, useCallback } from 'react';

interface FrequentQuestion {
  id: string;
  question: string;
  normalized_question: string;
  answer: string | null;
  count: number;
  last_asked_at: string;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<FrequentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/questions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const showToast = (message: string, type: string) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const startEdit = (q: FrequentQuestion) => {
    setEditingId(q.id);
    setEditAnswer(q.answer || '');
  };

  const saveAnswer = async (id: string) => {
    try {
      const res = await fetch('/api/admin/questions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, answer: editAnswer || null }),
      });

      if (res.ok) {
        showToast('Resposta salva!', 'success');
        setEditingId(null);
        fetchQuestions();
      }
    } catch {
      showToast('Erro ao salvar', 'error');
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Excluir esta pergunta frequente?')) return;

    try {
      const res = await fetch(`/api/admin/questions?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        showToast('Excluído!', 'success');
        fetchQuestions();
      }
    } catch {
      showToast('Erro ao excluir', 'error');
    }
  };

  const totalQuestions = questions.reduce((sum, q) => sum + q.count, 0);
  const withAnswer = questions.filter(q => q.answer).length;

  return (
    <div>
      <h1 className="admin-page-title">❓ Perguntas Frequentes</h1>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        O sistema aprende automaticamente com as perguntas dos clientes.
        Defina respostas padrão para economizar tokens e melhorar o tempo de resposta.
      </p>

      {/* Mini stats */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-icon">📝</div>
          <div className="stat-card-value">{questions.length}</div>
          <div className="stat-card-label">Perguntas únicas</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🔄</div>
          <div className="stat-card-value">{totalQuestions}</div>
          <div className="stat-card-label">Total de vezes perguntadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-value">{withAnswer}</div>
          <div className="stat-card-label">Com resposta padrão</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p>Nenhuma pergunta registrada ainda. As perguntas dos clientes aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pergunta</th>
                <th>Vezes</th>
                <th>Resposta padrão</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {questions.map(q => (
                <tr key={q.id}>
                  <td style={{ maxWidth: '350px' }}>
                    <div style={{ fontSize: '14px', marginBottom: '2px' }}>{q.question}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Última: {new Date(q.last_asked_at).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td>
                    <span className="count-badge">{q.count}</span>
                  </td>
                  <td style={{ maxWidth: '250px' }}>
                    {editingId === q.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea
                          className="form-textarea"
                          value={editAnswer}
                          onChange={e => setEditAnswer(e.target.value)}
                          rows={3}
                          style={{ minHeight: '70px', fontSize: '13px' }}
                          placeholder="Defina uma resposta padrão para esta pergunta..."
                          autoFocus
                        />
                        <div className="btn-group">
                          <button className="btn btn-primary btn-sm" onClick={() => saveAnswer(q.id)}>
                            Salvar
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : q.answer ? (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxHeight: '60px', overflow: 'hidden' }}>
                        {q.answer}
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sem resposta definida</span>
                    )}
                  </td>
                  <td>
                    <div className="btn-group">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEdit(q)}
                        title="Definir resposta"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteQuestion(q.id)}
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
