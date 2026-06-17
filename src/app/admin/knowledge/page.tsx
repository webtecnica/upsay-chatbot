'use client';

import { useState, useEffect, useCallback } from 'react';

interface Chunk {
  id: string;
  title: string;
  content: string;
  section: string;
  source: string;
  created_at: string;
}

export default function KnowledgePage() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingChunk, setEditingChunk] = useState<Chunk | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formSection, setFormSection] = useState('');
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  const fetchChunks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);
      if (sourceFilter) params.set('source', sourceFilter);

      const res = await fetch(`/api/admin/knowledge?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setChunks(data.chunks || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, sourceFilter, token]);

  useEffect(() => {
    fetchChunks();
  }, [fetchChunks]);

  const showToast = (message: string, type: string) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditingChunk(null);
    setFormTitle('');
    setFormContent('');
    setFormSection('');
    setShowModal(true);
  };

  const openEdit = (chunk: Chunk) => {
    setEditingChunk(chunk);
    setFormTitle(chunk.title);
    setFormContent(chunk.content);
    setFormSection(chunk.section);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      showToast('Título e conteúdo são obrigatórios', 'error');
      return;
    }

    try {
      const body = {
        ...(editingChunk ? { id: editingChunk.id } : {}),
        title: formTitle,
        content: formContent,
        section: formSection || 'Geral',
      };

      const res = await fetch('/api/admin/knowledge', {
        method: editingChunk ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast(editingChunk ? 'Atualizado com sucesso!' : 'Adicionado com sucesso!', 'success');
        setShowModal(false);
        fetchChunks();
      } else {
        showToast('Erro ao salvar', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    try {
      const res = await fetch(`/api/admin/knowledge?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        showToast('Excluído com sucesso!', 'success');
        fetchChunks();
      }
    } catch {
      showToast('Erro ao excluir', 'error');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchChunks();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>📚 Base de Conhecimento</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Adicionar</button>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Total: {total} itens na base
      </p>

      {/* Search and filters */}
      <form className="search-bar" onSubmit={handleSearch}>
        <input
          className="form-input"
          placeholder="Buscar por título ou conteúdo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-input"
          style={{ width: '160px', flex: 'none' }}
          value={sourceFilter}
          onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
        >
          <option value="">Todas as fontes</option>
          <option value="apostila">📄 Apostila</option>
          <option value="admin">✏️ Manual</option>
        </select>
        <button className="btn btn-secondary" type="submit">Buscar</button>
      </form>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Seção</th>
                  <th>Fonte</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {chunks.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                      Nenhum item encontrado
                    </td>
                  </tr>
                ) : (
                  chunks.map(chunk => (
                    <tr key={chunk.id}>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chunk.title}
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {chunk.section || '—'}
                      </td>
                      <td>
                        <span className={`source-badge ${chunk.source}`}>
                          {chunk.source === 'apostila' ? '📄 Apostila' : '✏️ Manual'}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(chunk)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(chunk.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`page-btn ${page === p ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingChunk ? '✏️ Editar Conhecimento' : '➕ Novo Conhecimento'}</h3>
            <div className="admin-form">
              <div className="form-group">
                <label className="form-label">Título *</label>
                <input
                  className="form-input"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ex: Como conectar o WhatsApp"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Seção</label>
                <input
                  className="form-input"
                  value={formSection}
                  onChange={e => setFormSection(e.target.value)}
                  placeholder="Ex: Conexões, FlowBuilder, Filas..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Conteúdo *</label>
                <textarea
                  className="form-textarea"
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  placeholder="Digite o conteúdo informativo..."
                  rows={8}
                />
              </div>
              <div className="btn-group">
                <button className="btn btn-primary" onClick={handleSave}>
                  {editingChunk ? 'Salvar Alterações' : 'Adicionar'}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
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
