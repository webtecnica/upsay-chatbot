'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ─── Type declarations for Web Speech API vendor prefix ─── */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

/* ─── Interfaces ─── */
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  imageUrl?: string;
  fileName?: string;
  isAudioMessage?: boolean;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  expires_at: string;
  created_at: string;
}

interface AttachedFile {
  type: 'image' | 'pdf';
  name: string;
  dataUrl: string; // base64 data URL for images, raw base64 for PDFs
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

/* ─── Constants ─── */
const SUGGESTIONS = [
  '📋 Como funciona o sistema de tickets?',
  '🔄 Como ativar o rodízio de atendentes?',
  '🤖 Como configurar o FlowBuilder?',
  '📱 Como conectar o WhatsApp?',
  '👥 Como adicionar um operador?',
  '⚙️ Como configurar filas?',
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_IMAGE_TYPES = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
  'image/bmp', 'image/svg+xml', 'image/tiff', 'image/x-icon',
];

/* ─── Utilities ─── */
function formatIncidentDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressImage(file: File, maxDim = 2048, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      img.src = e.target!.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/[*_~]/g, '')
    .replace(/<br\s*\/?>/g, '. ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function ChatPage() {
  /* ─── Existing states ─── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentAlertShown, setIncidentAlertShown] = useState(false);

  /* ─── New states ─── */
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreference, setAudioPreference] = useState<'text' | 'audio' | null>(null);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  /* ─── Refs ─── */
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const wasVoiceInputRef = useRef(false);

  /* ─── Init ─── */
  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  // Fetch incidents on load
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

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load voices for TTS
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices(); // Trigger voice loading
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  /* ─── Scroll to bottom ─── */
  const scrollToBottom = useCallback(() => {
    if (chatMessagesRef.current) {
      const container = chatMessagesRef.current;
      requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, showAudioPrompt, scrollToBottom]);

  /* ─── TTS: Speak text ─── */
  const speakText = useCallback((text: string, msgId?: string) => {
    if (!window.speechSynthesis) {
      setToast({ type: 'error', message: 'Seu navegador não suporta síntese de voz.' });
      return;
    }

    // If already speaking the same message, stop
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = stripMarkdown(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const francisca = voices.find(v => v.name.includes('Francisca'));
    const ptBrVoice = voices.find(v => v.lang === 'pt-BR');
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    utterance.voice = francisca || ptBrVoice || ptVoice || null;

    utterance.onstart = () => setSpeakingMsgId(msgId || null);
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    window.speechSynthesis.speak(utterance);
  }, [speakingMsgId]);

  /* ─── STT: Toggle recording ─── */
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setToast({ type: 'error', message: 'Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.' });
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
      wasVoiceInputRef.current = true;
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      setToast({ type: 'error', message: 'Erro no reconhecimento de voz. Verifique as permissões do microfone.' });
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    wasVoiceInputRef.current = true;
  }, [isRecording]);

  /* ─── File attachment handler ─── */
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // Reset for re-selection

    if (file.type === 'application/pdf') {
      if (file.size > MAX_PDF_SIZE) {
        setToast({ type: 'error', message: `PDF muito grande (${formatFileSize(file.size)}). Máximo: 20MB.` });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachedFile({ type: 'pdf', name: file.name, dataUrl: base64 });
      };
      reader.readAsDataURL(file);
    } else if (ACCEPTED_IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')) {
      if (file.size > MAX_IMAGE_SIZE) {
        setToast({ type: 'error', message: `Imagem muito grande (${formatFileSize(file.size)}). Máximo: 10MB.` });
        return;
      }
      try {
        const compressed = await compressImage(file);
        setAttachedFile({ type: 'image', name: file.name, dataUrl: compressed });
      } catch {
        setToast({ type: 'error', message: 'Erro ao processar a imagem.' });
      }
    } else {
      setToast({ type: 'error', message: 'Formato não suportado. Envie imagens (PNG, JPG, WEBP, GIF, BMP...) ou PDFs.' });
    }
  }, []);

  const removeAttachment = useCallback(() => {
    setAttachedFile(null);
  }, []);

  /* ─── Send message ─── */
  const sendMessage = async (text: string) => {
    if ((!text.trim() && !attachedFile) || isLoading) return;

    // Stop recording if active
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }

    const isAudioMsg = wasVoiceInputRef.current;
    wasVoiceInputRef.current = false;

    const messageText = text.trim() || 
      (attachedFile?.type === 'image' ? 'Analise esta imagem' : 'Analise este documento');

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      imageUrl: attachedFile?.type === 'image' ? attachedFile.dataUrl : undefined,
      fileName: attachedFile?.type === 'pdf' ? attachedFile.name : undefined,
      isAudioMessage: isAudioMsg,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setShowSuggestions(false);

    // Build request body
    const body: Record<string, unknown> = { message: messageText, sessionId };
    if (attachedFile?.type === 'image') {
      body.imageDataUrl = attachedFile.dataUrl;
    } else if (attachedFile?.type === 'pdf') {
      body.pdfBase64 = attachedFile.dataUrl;
      body.pdfFileName = attachedFile.name;
    }

    setAttachedFile(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      let answerContent = data.answer || 'Desculpe, ocorreu um erro. Tente novamente.';

      // Inject incident alert after first response
      if (!incidentAlertShown && incidents.length > 0 && messages.length === 0) {
        const incidentTexts = incidents.map(inc =>
          `⚠️ **${inc.title}**: ${inc.description} (Previsão de solução: ${formatIncidentDate(inc.expires_at)})`
        ).join('\n');

        answerContent += `\n\n---\n🚧 **Aviso de Incidente${incidents.length > 1 ? 's' : ''}:**\n${incidentTexts}`;
        setIncidentAlertShown(true);
      }

      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: answerContent,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Audio preference logic
      if (isAudioMsg && audioPreference === null) {
        setShowAudioPrompt(true);
      } else if (isAudioMsg && audioPreference === 'audio') {
        setTimeout(() => speakText(answerContent, assistantMsgId), 300);
      }
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

  /* ─── Audio preference handlers ─── */
  const handleAudioPreference = (pref: 'audio' | 'text') => {
    setAudioPreference(pref);
    setShowAudioPrompt(false);
    if (pref === 'audio') {
      setToast({ type: 'success', message: '🔊 Respostas em áudio ativadas para esta sessão!' });
      // Speak the last assistant message
      const lastAssistant = messages.filter(m => m.role === 'assistant').pop();
      if (lastAssistant) {
        speakText(lastAssistant.content, lastAssistant.id);
      }
    } else {
      setToast({ type: 'success', message: '📝 Respostas em texto mantidas.' });
    }
  };

  /* ─── Key handler ─── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  /* ─── Format message content ─── */
  const formatContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  };

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-logo">U</div>
        <div className="chat-header-info">
          <h1>UpBot</h1>
          <p>Online • Assistente UpSay</p>
        </div>
        {/* Audio preference toggle in header */}
        {audioPreference && (
          <button
            className={`audio-pref-toggle ${audioPreference === 'audio' ? 'active' : ''}`}
            onClick={() => {
              const newPref = audioPreference === 'audio' ? 'text' : 'audio';
              setAudioPreference(newPref);
              setToast({ type: 'success', message: newPref === 'audio' ? '🔊 Áudio ativado' : '📝 Somente texto' });
            }}
            title={audioPreference === 'audio' ? 'Respostas em áudio (clique para desativar)' : 'Respostas em texto (clique para ativar áudio)'}
          >
            {audioPreference === 'audio' ? '🔊' : '🔇'}
          </button>
        )}
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
            <div className="welcome-features">
              <span>🎤 Envie áudio</span>
              <span>📷 Envie imagens</span>
              <span>📄 Envie PDFs</span>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            {/* Image attachment */}
            {msg.imageUrl && (
              <div className="message-image-container">
                <img
                  src={msg.imageUrl}
                  alt="Imagem anexada"
                  className="message-image"
                  onClick={() => window.open(msg.imageUrl, '_blank')}
                />
              </div>
            )}

            {/* PDF badge */}
            {msg.fileName && (
              <div className="message-file-badge">
                <span className="file-icon">📄</span>
                <span className="file-name">{msg.fileName}</span>
              </div>
            )}

            {/* Voice indicator */}
            {msg.isAudioMessage && msg.role === 'user' && (
              <div className="message-voice-badge">🎤 Mensagem de voz</div>
            )}

            {/* Message bubble */}
            <div
              className="message-bubble"
              dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
            />

            {/* Message footer: time + TTS button for assistant */}
            <div className="message-footer">
              <span className="message-time">{msg.time}</span>
              {msg.role === 'assistant' && (
                <button
                  className={`tts-btn ${speakingMsgId === msg.id ? 'speaking' : ''}`}
                  onClick={() => speakText(msg.content, msg.id)}
                  title={speakingMsgId === msg.id ? 'Parar áudio' : 'Ouvir resposta'}
                >
                  {speakingMsgId === msg.id ? '⏹' : '🔊'}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="message message-assistant">
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}

        {/* Audio preference prompt */}
        {showAudioPrompt && (
          <div className="audio-preference-prompt">
            <div className="audio-prompt-icon">🎤</div>
            <p className="audio-prompt-title">Você enviou uma mensagem de voz!</p>
            <p className="audio-prompt-text">Deseja receber as respostas em áudio também?</p>
            <div className="audio-prompt-buttons">
              <button
                className="audio-prompt-btn audio-prompt-btn-audio"
                onClick={() => handleAudioPreference('audio')}
              >
                🔊 Sim, em áudio
              </button>
              <button
                className="audio-prompt-btn audio-prompt-btn-text"
                onClick={() => handleAudioPreference('text')}
              >
                📝 Somente texto
              </button>
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

      {/* Attachment preview */}
      {attachedFile && (
        <div className="attachment-preview">
          {attachedFile.type === 'image' ? (
            <div className="attachment-image-preview">
              <img src={attachedFile.dataUrl} alt={attachedFile.name} />
              <span className="attachment-name">{attachedFile.name}</span>
            </div>
          ) : (
            <div className="attachment-pdf-preview">
              <span className="attachment-pdf-icon">📄</span>
              <span className="attachment-name">{attachedFile.name}</span>
            </div>
          )}
          <button className="attachment-remove" onClick={removeAttachment} title="Remover anexo">
            ✕
          </button>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="recording-indicator">
          <span className="recording-dot"></span>
          <span>Ouvindo... fale agora</span>
        </div>
      )}

      {/* Input area */}
      <div className="chat-input-area">
        {/* Attach button */}
        <button
          className="chat-action-btn attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Anexar imagem ou PDF"
          aria-label="Anexar arquivo"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="file-input-hidden"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp,image/svg+xml,image/tiff,image/x-icon,.pdf"
          onChange={handleFileSelect}
        />

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder={isRecording ? '🎤 Ouvindo...' : 'Digite sua dúvida sobre a UpSay...'}
          value={input}
          onChange={e => {
            setInput(e.target.value);
            wasVoiceInputRef.current = false;
          }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          readOnly={isRecording}
        />

        {/* Mic button */}
        <button
          className={`chat-action-btn mic-btn ${isRecording ? 'recording' : ''}`}
          onClick={toggleRecording}
          disabled={isLoading}
          title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
          aria-label={isRecording ? 'Parar gravação' : 'Gravar áudio'}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>

        {/* Send button */}
        <button
          className="chat-send-btn"
          onClick={() => sendMessage(input)}
          disabled={(!input.trim() && !attachedFile) || isLoading}
          aria-label="Enviar mensagem"
        >
          ➤
        </button>
      </div>

      {/* Quick Tips Footer */}
      <div className="quick-tips-footer">
        <h3>💡 Dicas Rápidas</h3>
        <div className="quick-tips-row">
          <div className="quick-tip-card" onClick={() => sendMessage("Como conectar o WhatsApp na plataforma UpSay?")}>
            <span className="quick-tip-icon">📱</span>
            <div className="quick-tip-info">
              <h4>Conectar WhatsApp</h4>
              <p>Passo a passo simples</p>
            </div>
          </div>
          <div className="quick-tip-card" onClick={() => sendMessage("Como funciona o rodízio de atendentes?")}>
            <span className="quick-tip-icon">🔄</span>
            <div className="quick-tip-info">
              <h4>Rodízio de Equipes</h4>
              <p>Distribuição de contatos</p>
            </div>
          </div>
          <div className="quick-tip-card" onClick={() => sendMessage("Como configurar o FlowBuilder?")}>
            <span className="quick-tip-icon">🤖</span>
            <div className="quick-tip-info">
              <h4>FlowBuilder</h4>
              <p>Automatização de fluxos</p>
            </div>
          </div>
          <div className="quick-tip-card" onClick={() => sendMessage("Como cadastrar um novo atendente ou operador?")}>
            <span className="quick-tip-icon">👥</span>
            <div className="quick-tip-info">
              <h4>Cadastrar Operador</h4>
              <p>Adicionar atendentes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
}
