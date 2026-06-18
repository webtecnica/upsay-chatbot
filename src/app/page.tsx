'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  expires_at: string;
  created_at: string;
}

const SUGGESTIONS = [
  '📋 Como funciona o sistema de tickets?',
  '🔄 Como ativar o rodízio de atendentes?',
  '🤖 Como configurar o FlowBuilder?',
  '📱 Como conectar o WhatsApp?',
  '👥 Como adicionar um operador?',
  '⚙️ Como configurar filas?',
];

function formatIncidentDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentAlertShown, setIncidentAlertShown] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  // Fetch active incidents on load
  useEffect(() => {
    async function fetchIncidents() {
      try {
        const res = await fetch('/api/chat/incidents');
        const data = await res.json();
        setIncidents(data.incidents || []);
      } catch {
        // Silently fail - incidents are not critical
      }
    }
    fetchIncidents();
  }, []);

  const scrollToBottom = useCallback(() => {
    if (chatMessagesRef.current) {
      const container = chatMessagesRef.current;
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), sessionId }),
      });

      const data = await res.json();

      let answerContent = data.answer || 'Desculpe, ocorreu um erro. Tente novamente.';

      // Inject incident alert after first response (greeting) if there are active incidents
      if (!incidentAlertShown && incidents.length > 0 && messages.length === 0) {
        const incidentTexts = incidents.map(inc =>
          `⚠️ **${inc.title}**: ${inc.description} (Previsão de solução: ${formatIncidentDate(inc.expires_at)})`
        ).join('\n');

        answerContent += `\n\n---\n🚧 **Aviso de Incidente${incidents.length > 1 ? 's' : ''}:**\n${incidentTexts}`;
        setIncidentAlertShown(true);
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: answerContent,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '😔 Desculpe, estou com dificuldades no momento. Tente novamente em alguns instantes.',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatContent = (content: string) => {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-logo">U</div>
        <div className="chat-header-info">
          <h1>UpBot</h1>
          <p>Online • Assistente UpSay</p>
        </div>
      </div>

      {/* Incident Alert Banner */}
      {incidents.length > 0 && (
        <div className="incident-alert-banner" id="incident-alert-banner">
          <div className="incident-alert-header">
            ⚠️ {incidents.length === 1 ? 'Incidente Ativo' : `${incidents.length} Incidentes Ativos`}
          </div>
          {incidents.map(incident => (
            <div key={incident.id} className="incident-alert-item">
              <div className="incident-alert-title">{incident.title}</div>
              <div className="incident-alert-desc">{incident.description}</div>
              <div className="incident-alert-time">
                🕐 Previsão de solução: {formatIncidentDate(incident.expires_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages" ref={chatMessagesRef}>
        {messages.length === 0 && (
          <div className="welcome-container">
            <div className="welcome-icon">💬</div>
            <h2>Olá! Sou o UpBot 👋</h2>
            <p>
              Assistente virtual da plataforma UpSay. 
              Pergunte-me sobre funcionalidades, configurações, 
              integrações e muito mais!
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            <div
              className="message-bubble"
              dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
            />
            <div className="message-time">{msg.time}</div>
          </div>
        ))}

        {isLoading && (
          <div className="message message-assistant">
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && messages.length === 0 && (
        <div className="suggestions">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              className="suggestion-btn"
              onClick={() => sendMessage(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Digite sua dúvida sobre a UpSay..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          className="chat-send-btn"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          aria-label="Enviar mensagem"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
