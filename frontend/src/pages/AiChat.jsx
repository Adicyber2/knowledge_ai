import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { askAI } from "../service/aiService";
import { getKnowledge } from "../service/knowledgeService";
import {
  createChat,
  getChats,
  getChat,
  addChatMessage,
  deleteChat,
} from "../service/chatService";
import KnowledgeDetailsModal from "../components/KnowledgeDetailsModal";
import "./Aichat.css";


// Helper for source type icon
const getSourceIcon = (type) => {
  switch ((type || "").toLowerCase()) {
    case "youtube": return "▶️";
    case "pdf": return "📄";
    case "article": return "🌐";
    case "note": return "📝";
    default: return "✦";
  }
};


const AiChat = () => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // All saved knowledge stats
  const [knowledge, setKnowledge] = useState([]);

  // Details modal state
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatLoading, setChatLoading] = useState(true);


  // Load knowledge list for sidebar overview
  useEffect(() => {
    const loadKnowledge = async () => {
      try {
        const data = await getKnowledge();
        setKnowledge(data || []);
      } catch (error) {
        console.error("Failed to load knowledge stats:", error);
      }
    };
    loadKnowledge();
  }, []);


  // Load saved chats history
  useEffect(() => {
    const loadChats = async () => {
      try {
        setChatLoading(true);
        const data = await getChats();
        const chatList = data.chats || [];
        setChats(chatList);

        if (chatList.length > 0) {
          const firstChat = await getChat(chatList[0]._id);
          setActiveChatId(chatList[0]._id);
          setMessages(firstChat.chat?.messages || []);
        }
      } catch (error) {
        console.error("Failed to load chats:", error.response?.data || error.message);
      } finally {
        setChatLoading(false);
      }
    };
    loadChats();
  }, []);


  // Send message using Automatic Vault RAG
  const handleSend = async (e) => {
    e.preventDefault();

    if (!message.trim() || loading) return;

    const userQuestion = message.trim();

    try {
      setLoading(true);

      let chatId = activeChatId;

      // Create new chat if none selected
      if (!chatId) {
        const newChat = await createChat(message.substring(0, 40));
        chatId = newChat.chat._id;
        setChats((prev) => [newChat.chat, ...prev]);
        setActiveChatId(chatId);
      }

      // Save user message
      const userMessage = await addChatMessage(chatId, "user", userQuestion);
      setMessages(userMessage.chat.messages);
      setMessage("");

      // Automatic Vault RAG: AI automatically searches entire vault
      const aiData = await askAI(userQuestion);
      const answer = aiData.answer || "No response received.";
      const sources = aiData.sources || [];

      // Save assistant message + sources
      const assistantMessage = await addChatMessage(
        chatId,
        "assistant",
        answer,
        sources
      );

      setMessages(assistantMessage.chat.messages);

      // Update chat list
      setChats((prev) =>
        prev.map((c) => (c._id === chatId ? assistantMessage.chat : c))
      );
    } catch (error) {
      console.error("AI Chat Error:", error.response?.data || error.message);
      const errText = error.response?.data?.message || "Error: Could not reach AI service.";
      if (activeChatId) {
        const errMsg = await addChatMessage(activeChatId, "assistant", `⚠️ ${errText}`);
        setMessages(errMsg.chat.messages);
      }
    } finally {
      setLoading(false);
    }
  };


  // Select existing chat
  const handleSelectChat = async (chatId) => {
    try {
      setActiveChatId(chatId);
      const data = await getChat(chatId);
      setMessages(data.chat?.messages || []);
    } catch (error) {
      console.error("Load chat failed:", error.response?.data || error.message);
    }
  };


  // Create new chat
  const handleNewChat = async () => {
    try {
      const data = await createChat("New Chat");
      const newChat = data.chat;
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat._id);
      setMessages([]);
      setMessage("");
    } catch (error) {
      console.error("Create chat failed:", error.response?.data || error.message);
    }
  };


  // Delete chat
  const handleDeleteChat = async (chatId) => {
    try {
      await deleteChat(chatId);
      const remaining = chats.filter((c) => c._id !== chatId);
      setChats(remaining);

      if (activeChatId === chatId) {
        if (remaining.length > 0) {
          const next = remaining[0];
          setActiveChatId(next._id);
          const data = await getChat(next._id);
          setMessages(data.chat?.messages || []);
        } else {
          setActiveChatId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Delete chat failed:", error.response?.data || error.message);
    }
  };


  // Open Knowledge Details Modal for a source
  const handleOpenSourceDetail = (src) => {
    // Check if matching document exists in knowledge array
    const matched = knowledge.find(
      (k) => k._id.toString() === src.knowledgeId || k.title === src.title
    );
    if (matched) {
      setSelectedDetailItem(matched);
    } else {
      setSelectedDetailItem({
        title: src.title,
        sourceType: src.sourceType,
        sourceUrl: src.sourceUrl,
        summary: "Source retrieved from Knowledge Vault.",
      });
    }
  };


  return (
    <div className="vault-layout" style={{ minHeight: "100vh" }}>
      <Sidebar />

      <div className="ai-workspace" style={{ flex: 1 }}>

        {/* =====================================================
            LEFT SIDEBAR — CHAT HISTORY
        ===================================================== */}

        <aside className="chat-sidebar">

          <button onClick={handleNewChat} className="new-chat-btn">
            <span className="new-chat-icon">＋</span>
            New Chat
          </button>

          <div className="chat-history-header">
            <span>Chat History</span>
            <span className="chat-count">{chats.length}</span>
          </div>

          <div className="chat-history">
            {chatLoading ? (
              <p className="chat-status">Loading chats...</p>
            ) : chats.length === 0 ? (
              <p className="chat-status">No chats yet</p>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat._id}
                  className={`chat-history-item ${
                    activeChatId === chat._id ? "active" : ""
                  }`}
                >
                  <button
                    onClick={() => handleSelectChat(chat._id)}
                    className="chat-history-title"
                  >
                    <span className="chat-icon">💬</span>
                    <span className="chat-title-text">{chat.title}</span>
                  </button>

                  <button
                    onClick={() => handleDeleteChat(chat._id)}
                    className="delete-chat-btn"
                    title="Delete chat"
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>

        </aside>


        {/* =====================================================
            CENTER — AI CHAT
        ===================================================== */}

        <main className="ai-main">

          {/* Chat Header */}

          <div className="ai-chat-header">
            <div>
              <h2>AI Assistant</h2>
              <p>Ask questions across your entire Knowledge Vault</p>
            </div>

            <div className="active-context-badge">
              <span className="context-dot" style={{ background: "#22c55e" }} />
              Auto Vault RAG Active
            </div>
          </div>


          {/* MESSAGES */}

          <div className="chat-messages">

            {messages.length === 0 && !loading && (
              <div className="empty-chat">
                <div className="empty-chat-icon">✦</div>
                <h2>What would you like to know?</h2>
                <p>
                  Ask anything about your saved notes, articles, PDFs, or YouTube videos.
                  AI automatically searches your Knowledge Vault.
                </p>
              </div>
            )}


            {messages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}`}>

                {msg.role === "assistant" && (
                  <div className="assistant-avatar">✦</div>
                )}

                <div className="message-content">
                  <div>{msg.content}</div>

                  {/* Sources Reference Cards */}
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <div className="ai-sources-card">
                      <span className="ai-sources-title">Sources Used:</span>
                      <div className="ai-sources-list">
                        {msg.sources.map((src, sIdx) => (
                          <div
                            key={sIdx}
                            className="ai-source-item"
                            style={{ cursor: "pointer" }}
                            onClick={() => handleOpenSourceDetail(src)}
                          >
                            <span className="source-icon">{getSourceIcon(src.sourceType)}</span>
                            <span className="source-title">{src.title}</span>
                            {src.sourceUrl && (
                              <a
                                href={src.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View ↗
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

              </div>
            ))}


            {loading && (
              <div className="chat-message assistant">
                <div className="assistant-avatar">✦</div>
                <div className="thinking">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

          </div>


          {/* INPUT FORM */}

          <div className="chat-input-wrapper">
            <form onSubmit={handleSend} className="chat-input-form">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask anything about your saved knowledge..."
                disabled={loading}
              />

              <button type="submit" disabled={loading || !message.trim()}>
                {loading ? <span className="send-loader" /> : "➤"}
              </button>
            </form>

            <p className="ai-disclaimer">
              AI automatically searches your Vault. Responses are grounded strictly in your saved knowledge.
            </p>
          </div>

        </main>


        {/* =====================================================
            RIGHT SIDEBAR — VAULT RAG STATUS
        ===================================================== */}

        <aside className="knowledge-sidebar">

          <div className="knowledge-panel-header">
            <div>
              <h3>Vault RAG Engine</h3>
              <p>Automatic hybrid search</p>
            </div>
            <div className="knowledge-count" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
              ✓ ACTIVE
            </div>
          </div>


          {/* Automatic RAG Status Card */}

          <div className="rag-status-card" style={{ padding: "16px", border: "1px solid #1f2330", borderRadius: "12px", background: "#0d0f17", marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <span style={{ fontSize: "20px" }}>⚡</span>
              <div>
                <strong style={{ fontSize: "13px", color: "#f8fafc", display: "block" }}>Zero Selection Required</strong>
                <small style={{ color: "#94a3b8", fontSize: "11px" }}>Searching {knowledge.length} items automatically</small>
              </div>
            </div>

            <p style={{ color: "#64748b", fontSize: "12px", lineHeight: "1.5" }}>
              Performs vector semantic search + MongoDB keyword search across your vault on every query.
            </p>
          </div>


          {/* Saved Vault Overview */}

          <div className="knowledge-context" style={{ marginTop: "20px" }}>
            <label className="knowledge-label">
              Indexed Vault Items ({knowledge.length})
            </label>

            <div className="knowledge-list">
              {knowledge.length === 0 ? (
                <p className="knowledge-empty">No saved knowledge found.</p>
              ) : (
                knowledge.map((item) => (
                  <div
                    key={item._id}
                    className="knowledge-item"
                    style={{ padding: "10px 12px", opacity: 0.85, cursor: "pointer" }}
                    onClick={() => setSelectedDetailItem(item)}
                  >
                    <span style={{ fontSize: "14px", marginRight: "8px" }}>
                      {getSourceIcon(item.sourceType)}
                    </span>

                    <div className="knowledge-item-info">
                      <span className="knowledge-item-title">{item.title}</span>
                      <span className="knowledge-item-type">{item.sourceType || "Knowledge"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </aside>

      </div>

      {/* Shared Knowledge Details Modal for clicked sources */}
      {selectedDetailItem && (
        <KnowledgeDetailsModal
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
        />
      )}
    </div>
  );
};

export default AiChat;