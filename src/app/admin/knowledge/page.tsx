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

interface AdditionalItem {
  id: string;
  category: string;
  title: string;
  description: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type Category = 'incidentes' | 'avisos' | 'melhorias' | 'recomendacoes';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'incidentes', label: 'Incidentes', icon: '🚨' },
  { key: 'avisos', label: 'Avisos', icon: '📢' },
  { key: 'melhorias', label: 'Melhorias', icon: '🚀' },
  { key: 'recomendacoes', label: 'Recomendações', icon: '💡' },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getIncidentStatus(item: AdditionalItem): 'active' | 'expired' | 'inactive' {
  if (!item.is_active) return 'inactive';
  if (item.category === 'incidentes' && item.expires_at) {
    return new Date(item.expires_at) > new Date() ? 'active' : 'expired';
  }
  return 'active';
}

function getCountdown(expiresAt: string): string {
  const now = new Date().getTime();
  const target = new Date(expiresAt).getTime();
  const diff = target - now;

  if (diff <= 0) return 'Expirado';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h restantes`;
  }
  return `${hours}h ${minutes}m restantes`;
}

export default function KnowledgePage() {
  // ---- Knowledge Base state ----
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

  // ---- ADICIONAIS state ----
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>([]);
  const [activeTab, setActiveTab] = useState<Category>('incidentes');
  const [loadingAdditional, setLoadingAdditional] = useState(true);
  const [showAdditionalModal, setShowAdditionalModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AdditionalItem | null>(null);
  const [addFormTitle, setAddFormTitle] = useState('');
  const [addFormDescription, setAddFormDescription] = useState('');
  const [addFormCategory, setAddFormCategory] = useState<Category>('incidentes');
  const [addFormExpiresAt, setAddFormExpiresAt] = useState('');

  // ---- Shared state ----
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  // ---- Knowledge Base functions ----
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

  // ---- ADICIONAIS functions ----
  const fetchAdditionalItems = useCallback(async () => {
    setLoadingAdditional(true);
    try {
      const res = await fetch('/api/admin/additional', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAdditionalItems(data.items || []);
    } catch (err) {
      console.error('Error fetching additional items:', err);
    } finally {
      setLoadingAdditional(false);
    }
  }, [token]);

  useEffect(() => {
    fetchChunks();
    fetchAdditionalItems();
  }, [fetchChunks, fetchAdditionalItems]);

  // Countdown timer for active incidents
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (message: string, type: string) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ---- Knowledge modal handlers ----
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

  // ---- ADICIONAIS modal handlers ----
  const openAdditionalAdd = () => {
    setEditingItem(null);
    setAddFormTitle('');
    setAddFormDescription('');
    setAddFormCategory(activeTab);
    setAddFormExpiresAt('');
    setShowAdditionalModal(true);
  };

  const openAdditionalEdit = (item: AdditionalItem) => {
    setEditingItem(item);
    setAddFormTitle(item.title);
    setAddFormDescription(item.description);
    setAddFormCategory(item.category as Category);
    setAddFormExpiresAt(item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : '');
    setShowAdditionalModal(true);
  };

  const handleAdditionalSave = async () => {
    if (!addFormTitle.trim() || !addFormDescription.trim()) {
      showToast('Título e descrição são obrigatórios', 'error');
      return;
    }

    if (addFormCategory === 'incidentes' && !addFormExpiresAt) {
      showToast('Incidentes requerem data/hora de expiração', 'error');
      return;
    }

    try {
      const body: Record<string, unknown> = {
        ...(editingItem ? { id: editingItem.id } : {}),
        category: addFormCategory,
        title: addFormTitle,
        description: addFormDescription,
      };

      if (addFormExpiresAt) {
        body.expires_at = new Date(addFormExpiresAt).toISOString();
      }

      if (editingItem) {
        body.is_active = editingItem.is_active;
      }

      const res = await fetch('/api/admin/additional', {
        method: editingItem ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast(editingItem ? 'Atualizado com sucesso!' : 'Adicionado com sucesso!', 'success');
        setShowAdditionalModal(false);
        fetchAdditionalItems();
      } else {
        const data = await res.json();
        showToast(data.error || 'Erro ao salvar', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    }
  };

  const handleAdditionalDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item permanentemente?')) return;

    try {
      const res = await fetch(`/api/admin/additional?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        showToast('Excluído com sucesso!', 'success');
        fetchAdditionalItems();
      }
    } catch {
      showToast('Erro ao excluir', 'error');
    }
  };

  const toggleAdditionalActive = async (item: AdditionalItem) => {
    try {
      const res = await fetch('/api/admin/additional', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: item.id,
          title: item.title,
          description: item.description,
          category: item.category,
          expires_at: item.expires_at,
          is_active: !item.is_active,
        }),
      });

      if (res.ok) {
        showToast(item.is_active ? 'Item desativado' : 'Item ativado', 'success');
        fetchAdditionalItems();
      }
    } catch {
      showToast('Erro ao atualizar', 'error');
    }
  };

  // ---- Computed data ----
  const filteredItems = additionalItems.filter(item => item.category === activeTab);
  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = additionalItems.filter(item => item.category === cat.key).length;
    return acc;
  }, {} as Record<Category, number>);

  return (
    <div>
      {/* ============================================
          ADICIONAIS PANEL
          ============================================ */}
      <div className="additional-panel" id="additional-panel">
        <div className="additional-panel-header">
          <h2>📋 ADICIONAIS</h2>
          <button className="btn btn-primary btn-sm" onClick={openAdditionalAdd}>
            + Adicionar
          </button>
        </div>

        {/* Tabs */}
        <div className="additional-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`additional-tab tab-${cat.key} ${activeTab === cat.key ? 'active' : ''}`}
              onClick={() => setActiveTab(cat.key)}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="tab-count">{categoryCounts[cat.key]}</span>
            </button>
          ))}
        </div>

        {/* Cards */}
        {loadingAdditional ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Carregando...</p>
        ) : filteredItems.length === 0 ? (
          <div className="additional-empty">
            <div className="additional-empty-icon">
              {CATEGORIES.find(c => c.key === activeTab)?.icon}
            </div>
            <p>Nenhum item em {CATEGORIES.find(c => c.key === activeTab)?.label}</p>
          </div>
        ) : (
          <div className="additional-cards">
            {filteredItems.map(item => {
              const status = getIncidentStatus(item);
              return (
                <div key={item.id} className={`additional-card ${status}`}>
                  <div className="additional-card-header">
                    <div className="additional-card-title">
                      {item.category === 'incidentes' && (
                        <span className={`status-dot ${status}`} />
                      )}
                      {item.title}
                    </div>
                    <div className="btn-group" style={{ flexShrink: 0 }}>
                      {item.category === 'incidentes' && (
                        <label className="toggle-switch" title={item.is_active ? 'Ativo' : 'Inativo'}>
                          <input
                            type="checkbox"
                            checked={item.is_active}
                            onChange={() => toggleAdditionalActive(item)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => openAdditionalEdit(item)}>
                        ✏️
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleAdditionalDelete(item.id)}>
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="additional-card-description">{item.description}</div>

                  <div className="additional-card-meta">
                    {item.category === 'incidentes' && item.expires_at && (
                      <>
                        <span className={`status-badge ${status}`}>
                          {status === 'active' ? '🔴 Ativo' : status === 'expired' ? '⚪ Expirado' : '⏸️ Inativo'}
                        </span>
                        {status === 'active' && (
                          <span className="countdown-badge">
                            ⏱️ {getCountdown(item.expires_at)}
                          </span>
                        )}
                        <span>
                          {status === 'expired' ? 'Expirou' : 'Expira'}: {formatDate(item.expires_at)}
                        </span>
                      </>
                    )}
                    <span>📅 Criado: {formatDate(item.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="section-divider">
        <span>Base de Conhecimento</span>
      </div>

      {/* ============================================
          KNOWLEDGE BASE (original)
          ============================================ */}
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

      {/* ============================================
          KNOWLEDGE MODAL
          ============================================ */}
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

      {/* ============================================
          ADICIONAIS MODAL
          ============================================ */}
      {showAdditionalModal && (
        <div className="modal-overlay" onClick={() => setShowAdditionalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingItem ? '✏️ Editar Item' : '➕ Novo Item Adicional'}</h3>
            <div className="admin-form">
              <div className="form-group">
                <label className="form-label">Categoria *</label>
                <select
                  className="form-input"
                  value={addFormCategory}
                  onChange={e => setAddFormCategory(e.target.value as Category)}
                  disabled={!!editingItem}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.key} value={cat.key}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Título *</label>
                <input
                  className="form-input"
                  value={addFormTitle}
                  onChange={e => setAddFormTitle(e.target.value)}
                  placeholder="Ex: Manutenção programada do servidor"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descrição *</label>
                <textarea
                  className="form-textarea"
                  value={addFormDescription}
                  onChange={e => setAddFormDescription(e.target.value)}
                  placeholder="Descreva os detalhes..."
                  rows={4}
                />
              </div>

              {addFormCategory === 'incidentes' && (
                <div className="form-group">
                  <label className="form-label">Data/Hora de Expiração *</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={addFormExpiresAt}
                    onChange={e => setAddFormExpiresAt(e.target.value)}
                  />
                  <span className="form-hint">
                    ⏱️ O incidente ficará ativo no chat até esta data/hora. Após expirar, não será exibido aos usuários mas permanecerá no histórico.
                  </span>
                </div>
              )}

              <div className="btn-group">
                <button className="btn btn-primary" onClick={handleAdditionalSave}>
                  {editingItem ? 'Salvar Alterações' : 'Adicionar'}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowAdditionalModal(false)}>
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
