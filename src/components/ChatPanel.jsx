import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { chat as aiChat } from "../lib/aiRouter";

const ChatPanel = ({ summary, noteText }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (summary) {
      setMessages([
        { role: "assistant", content: "I've read your notes. What would you like to know?" },
      ]);
    } else {
      setMessages([]);
    }
  }, [summary]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const context = noteText || summary || '';
      const history = messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      await aiChat(userMessage, context, history, (chunk, fullText) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullText };
          return updated;
        });
      });
    } catch (error) {
      const errorMsg = error.message?.includes('No Ollama')
        ? 'No AI models available. Start Ollama or add a Groq API key in Settings.'
        : 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "user", content: userMessage },
        { role: "assistant", content: errorMsg },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!summary) return null;

  return (
    <div
      style={{
        marginTop: "1.5rem",
        borderTop: "1px solid var(--border-color)",
        paddingTop: "1.25rem",
      }}
    >
      <div
        style={{
          fontSize: "0.9375rem",
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Bot size={17} />
        Ask a follow-up question
      </div>

      <div
        style={{
          maxHeight: "320px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          marginBottom: "1rem",
          paddingRight: "0.5rem",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "0.625rem",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                minWidth: "30px",
                borderRadius: "50%",
                backgroundColor:
                  msg.role === "assistant"
                    ? "hsla(262,80%,60%,0.12)"
                    : "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color:
                  msg.role === "assistant"
                    ? "var(--accent-primary)"
                    : "var(--text-secondary)",
                marginTop: "2px",
              }}
            >
              {msg.role === "assistant" ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div
              style={{
                fontSize: "0.875rem",
                lineHeight: "1.6",
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                flex: 1,
                paddingTop: "4px",
              }}
            >
              {msg.content}
              {isLoading && i === messages.length - 1 && msg.role === "assistant" && !msg.content && (
                <span className="typing-dots" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something about your notes..."
          disabled={isLoading}
          className="input-premium"
          style={{ flex: 1, fontSize: "0.875rem", padding: "0.625rem 0.875rem" }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          style={{
            width: "40px",
            height: "40px",
            minWidth: "40px",
            minHeight: "40px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--accent-primary)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
            opacity: isLoading || !input.trim() ? 0.6 : 1,
          }}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
