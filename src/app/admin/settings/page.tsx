'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const showToast = (message: string, type: string) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showToast('As senhas não conferem', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('A nova senha deve ter no mínimo 6 caracteres', 'error');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Senha alterada com sucesso!', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast(data.error || 'Erro ao alterar senha', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="admin-page-title">⚙️ Configurações</h1>

      {/* Change Password */}
      <div className="chart-container" style={{ maxWidth: '500px' }}>
        <h3>🔑 Alterar Senha</h3>
        <form className="admin-form" onSubmit={handleChangePassword} style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label">Senha Atual</label>
            <input
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nova Senha</label>
            <input
              type="password"
              className="form-input"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar Nova Senha</label>
            <input
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Alterar Senha'}
          </button>
        </form>
      </div>

      {/* Bot info */}
      <div className="chart-container" style={{ maxWidth: '500px', marginTop: '24px' }}>
        <h3>🤖 Informações do Bot</h3>
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Modelo</span>
            <span style={{ color: 'var(--text-primary)' }}>DeepSeek V4 Flash</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Temperatura</span>
            <span style={{ color: 'var(--text-primary)' }}>0.3</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Max Tokens</span>
            <span style={{ color: 'var(--text-primary)' }}>800</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: 'var(--text-muted)' }}>RAG</span>
            <span style={{ color: 'var(--text-primary)' }}>PostgreSQL Full-Text Search</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Cache</span>
            <span style={{ color: 'var(--success)' }}>✅ DeepSeek Prefix Caching</span>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
