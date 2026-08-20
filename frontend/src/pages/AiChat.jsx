import { useEffect, useState } from "react";
import { askAI } from "../service/aiService";
import { getKnowledge } from "../service/knowledgeService";
import {
  createChat,
  getChats,
  getChat,
  addChatMessage,
  deleteChat,
} from "../service/chatService";
import "./Aichat.css";

const AiChat = () => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // All saved knowledge
  const [knowledge, setKnowledge] = useState([]);

  // Selected knowledge IDs
  const [selectedIds, setSelectedIds] = useState([]);

  // Chat messages
  const [messages, setMessages] = useState([]);

  const [chats, setChats] = useState([]);
const [activeChatId, setActiveChatId] = useState(null);
const [chatLoading, setChatLoading] = useState(true);




  // Load knowledge
  useEffect(() => {
    const loadKnowledge = async () => {
      try {
        const data = await getKnowledge();

        setKnowledge(data || []);
      } catch (error) {
        console.error(
          "Failed to load knowledge:",
          error
        );
      }
    };

    loadKnowledge();
  }, []);


  // Load saved chats
useEffect(() => {
  const loadChats = async () => {
    try {
      setChatLoading(true);

      const data = await getChats();

      const chatList = data.chats || [];

      setChats(chatList);

      // Open first chat automatically
      if (chatList.length > 0) {
        const firstChat = await getChat(
          chatList[0]._id
        );

        setActiveChatId(chatList[0]._id);

        setMessages(
          firstChat.chat?.messages || []
        );
      }
    } catch (error) {
      console.error(
        "Failed to load chats:",
        error.response?.data || error.message
      );
    } finally {
      setChatLoading(false);
    }
  };

  loadChats();
}, []);

  // Select / deselect knowledge
  const toggleKnowledge = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const selectedKnowledge = knowledge.filter((item) =>
  selectedIds.includes(item._id)
);

  // Send message
const handleSend = async (e) => {
  e.preventDefault();

  if (!message.trim() || loading) return;

  const userQuestion = message.trim();

  try {
    setLoading(true);

    // Current chat ID
    let chatId = activeChatId;

    // If no chat exists, create one
    if (!chatId) {
      const newChat = await createChat(
  message.substring(0, 40),
  selectedIds
);

      chatId = newChat.chat._id;

      setChats((prev) => [
        newChat.chat,
        ...prev,
      ]);

      setActiveChatId(chatId);
    }

    // Save user message
    const userMessage = await addChatMessage(
      chatId,
      "user",
      userQuestion
    );

    setMessages(
      userMessage.chat.messages
    );

    // Clear input
    setMessage("");

    // Ask AI
    const aiData = await askAI(
      userQuestion,
      selectedIds
    );

    const answer =
      aiData.answer ||
      "No answer received.";

    // Save AI response
    const assistantMessage =
      await addChatMessage(
        chatId,
        "assistant",
        answer
      );

    setMessages(
      assistantMessage.chat.messages
    );

    // Update sidebar chat
    setChats((prev) =>
      prev.map((chat) =>
        chat._id === chatId
          ? assistantMessage.chat
          : chat
      )
    );
  } catch (error) {
    console.error(
      "AI Chat Error:",
      error.response?.data || error.message
    );
  } finally {
    setLoading(false);
  }
};

// select chat 

// Open existing chat
const handleSelectChat = async (chatId) => {
  try {
    setActiveChatId(chatId);

    const data = await getChat(chatId);

    const chat = data.chat;

    setMessages(chat?.messages || []);

    setSelectedIds(
      chat?.knowledgeIds || []
    );
  } catch (error) {
    console.error(
      "Load chat failed:",
      error.response?.data || error.message
    );
  }
};


// Create new chat
const handleNewChat = async () => {
  try {
    const data = await createChat("New Chat");

    const newChat = data.chat;

    setChats((prev) => [
      newChat,
      ...prev,
    ]);

    setActiveChatId(newChat._id);
    setMessages([]);
    setMessage("");
  } catch (error) {
    console.error(
      "Create chat failed:",
      error.response?.data || error.message
    );
  }
};

// delate chat

const handleDeleteChat = async (chatId) => {
  try {
    await deleteChat(chatId);

    const remainingChats = chats.filter(
      (chat) => chat._id !== chatId
    );

    setChats(remainingChats);

    if (activeChatId === chatId) {
      if (remainingChats.length > 0) {
        const nextChat = remainingChats[0];

        setActiveChatId(nextChat._id);

        const data = await getChat(
          nextChat._id
        );

        setMessages(
          data.chat?.messages || []
        );
      } else {
        setActiveChatId(null);
        setMessages([]);
      }
    }
  } catch (error) {
    console.error(
      "Delete chat failed:",
      error.response?.data || error.message
    );
  }
};

 return (
  <div className="ai-workspace">

    {/* =====================================================
        LEFT SIDEBAR — CHAT HISTORY
    ===================================================== */}

    <aside className="chat-sidebar">

      <button
        onClick={handleNewChat}
        className="new-chat-btn"
      >
        <span className="new-chat-icon">＋</span>
        New Chat
      </button>


      <div className="chat-history-header">
        <span>Chat History</span>
        <span className="chat-count">
          {chats.length}
        </span>
      </div>


      <div className="chat-history">

        {chatLoading ? (
          <p className="chat-status">
            Loading chats...
          </p>

        ) : chats.length === 0 ? (

          <p className="chat-status">
            No chats yet
          </p>

        ) : (

          chats.map((chat) => (

            <div
              key={chat._id}
              className={`chat-history-item ${
                activeChatId === chat._id
                  ? "active"
                  : ""
              }`}
            >

              <button
                onClick={() =>
                  handleSelectChat(chat._id)
                }
                className="chat-history-title"
              >
                <span className="chat-icon">
                  💬
                </span>

                <span className="chat-title-text">
                  {chat.title}
                </span>
              </button>


              <button
                onClick={() =>
                  handleDeleteChat(chat._id)
                }
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

          <p>
            Ask questions from your knowledge
          </p>
        </div>

        {selectedKnowledge.length > 0 && (
          <div className="active-context-badge">
            <span className="context-dot"></span>

            {selectedKnowledge.length} knowledge
            {selectedKnowledge.length > 1
              ? " sources"
              : " source"}
          </div>
        )}

      </div>


      {/* =================================================
          MESSAGES
      ================================================= */}

      <div className="chat-messages">

        {messages.length === 0 && !loading && (

          <div className="empty-chat">

            <div className="empty-chat-icon">
              ✦
            </div>

            <h2>
              How can I help you?
            </h2>

            <p>
              Ask anything about your selected
              knowledge.
            </p>

          </div>

        )}


        {messages.map((msg, index) => (

          <div
            key={index}
            className={`chat-message ${msg.role}`}
          >

            {msg.role === "assistant" && (
              <div className="assistant-avatar">
                ✦
              </div>
            )}

            <div className="message-content">
              {msg.content}
            </div>

          </div>

        ))}


        {loading && (

          <div className="chat-message assistant">

            <div className="assistant-avatar">
              ✦
            </div>

            <div className="thinking">

              <span></span>
              <span></span>
              <span></span>

            </div>

          </div>

        )}

      </div>


      {/* =================================================
          INPUT
      ================================================= */}

      <div className="chat-input-wrapper">

        <form
          onSubmit={handleSend}
          className="chat-input-form"
        >

          <input
            type="text"
            value={message}
            onChange={(e) =>
              setMessage(e.target.value)
            }
            placeholder="Ask something about your knowledge..."
            disabled={loading}
          />

          <button
            type="submit"
            disabled={
              loading ||
              !message.trim()
            }
          >

            {loading ? (
              <span className="send-loader"></span>
            ) : (
              "➤"
            )}

          </button>

        </form>

        <p className="ai-disclaimer">
          AI can make mistakes. Verify important information.
        </p>

      </div>

    </main>


    {/* =====================================================
        RIGHT SIDEBAR — KNOWLEDGE
    ===================================================== */}

    <aside className="knowledge-sidebar">

      <div className="knowledge-panel-header">

        <div>
          <h3>Knowledge</h3>

          <p>
            Choose what AI should use
          </p>
        </div>

        <div className="knowledge-count">
          {selectedIds.length}
        </div>

      </div>


      {/* Knowledge Selector */}

      <div className="knowledge-context">

        <label className="knowledge-label">
          Your saved knowledge
        </label>


        <div className="knowledge-list">

          {knowledge.length === 0 ? (

            <p className="knowledge-empty">
              No saved knowledge found.
            </p>

          ) : (

            knowledge.map((item) => (

              <label
                key={item._id}
                className={`knowledge-item ${
                  selectedIds.includes(item._id)
                    ? "selected"
                    : ""
                }`}
              >

                <input
                  type="checkbox"
                  checked={selectedIds.includes(
                    item._id
                  )}
                  onChange={() =>
                    toggleKnowledge(item._id)
                  }
                />


                <div className="knowledge-item-info">

                  <span className="knowledge-item-title">
                    {item.title}
                  </span>

                  <span className="knowledge-item-type">
                    {item.sourceType || "Knowledge"}
                  </span>

                </div>

              </label>

            ))

          )}

        </div>

      </div>


      {/* Selected Knowledge */}

      {selectedKnowledge.length > 0 && (

        <div className="selected-knowledge">

          <div className="selected-title">
            Currently using
          </div>


          {selectedKnowledge.map((item) => (

            <div
              key={item._id}
              className="selected-knowledge-item"
            >

              <span className="selected-file-icon">
                ✓
              </span>

              <span>
                {item.title}
              </span>

            </div>

          ))}

        </div>

      )}

    </aside>

  </div>
);
};

export default AiChat;