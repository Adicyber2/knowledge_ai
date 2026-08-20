import React from 'react'
import { useState } from "react";
import { askAI } from "../service/aiService";
import { useEffect } from "react";
import { getKnowledge } from "../service/knowledgeService";

const AiChat = () => {
    const [message, setMessage] = useState("");
const [selectedKnowledge, setSelectedKnowledge] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const loadKnowledge = async () => {
    try {
      const data = await getKnowledge();

      setSelectedKnowledge(data || []);
    } catch (error) {
      console.error("Failed to load knowledge:", error);
    }
  };

  loadKnowledge();
}, []);


const handleSend = async (e) => {
  e.preventDefault();

  if (!message.trim() || loading) return;

  const userMessage = message.trim();
  const knowledgeIds = selectedKnowledge.map(
  (item) => item._id
);

const data = await askAI(
  userMessage,
  knowledgeIds
);

  setMessages((prev) => [
    ...prev,
    {
      role: "user",
      content: userMessage,
    },
  ]);

  setMessage("");
  setLoading(true);

  try {
    const data = await askAI(userMessage);

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          data.answer ||
          data.response ||
          "No response received.",
      },
    ]);
  } catch (error) {
    console.error(
      "AI Chat Error:",
      error.response?.data || error.message
    );

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "Sorry, AI response failed.",
      },
    ]);
  } finally {
    setLoading(false);
  }
};


  return (
    <div>
        <div className="knowledge-context">
  <label>
    Use my saved knowledge
  </label>

  <select
    multiple
    value={selectedKnowledge.map(
      (item) => item._id
    )}
    onChange={(e) => {
      const ids = Array.from(
        e.target.selectedOptions,
        (option) => option.value
      );

      setSelectedKnowledge((prev) =>
        prev.filter((item) =>
          ids.includes(item._id)
        )
      );
    }}
  >
    {selectedKnowledge.map((item) => (
      <option
        key={item._id}
        value={item._id}
      >
        {item.title}
      </option>
    ))}
  </select>
</div>

        <div className="chat-messages">
  {messages.map((msg, index) => (
    <div
      key={index}
      className={`chat-message ${msg.role}`}
    >
      {msg.content}
    </div>
  ))}

  {loading && (
    <div className="chat-message assistant">
      Thinking...
    </div>
  )}
</div>

<form onSubmit={handleSend} className="chat-input-form">
  <input
    type="text"
    value={message}
    onChange={(e) => setMessage(e.target.value)}
    placeholder="Ask something..."
  />

  <button
    type="submit"
    disabled={loading || !message.trim()}
  >
    {loading ? "..." : "Send"}
  </button>
</form>
      
    </div>
  )
}

export default AiChat
