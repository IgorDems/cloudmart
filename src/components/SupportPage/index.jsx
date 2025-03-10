import React, { useState, useEffect, useRef } from "react";
import { Send, Plus, Trash2, AlertCircle } from "lucide-react";
import Header from "../Header";
import Footer from "../Footer";
import api from "../../config/axiosConfig";

const TypingIndicator = () => (
  <div className="inline-flex items-center space-x-1 bg-gray-200 rounded-lg px-3 py-3" role="status" aria-label="Assistant is typing">
    <div
      className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
      style={{ animationDelay: "0ms" }}
    ></div>
    <div
      className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
      style={{ animationDelay: "150ms" }}
    ></div>
    <div
      className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
      style={{ animationDelay: "300ms" }}
    ></div>
  </div>
);

const CustomerSupportPage = () => {
  const [threads, setThreads] = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [endedThreads, setEndedThreads] = useState([]);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connected");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize and load threads
  useEffect(() => {
    loadThreadsFromLocalStorage();
    checkApiConnection();
  }, []);

  // Load messages when current thread changes
  useEffect(() => {
    if (currentThreadId) {
      loadMessagesForThread(currentThreadId);
    }
  }, [currentThreadId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Check API connection status
  const checkApiConnection = async () => {
    try {
      await api.get("/health");
      setConnectionStatus("connected");
    } catch (error) {
      setConnectionStatus("disconnected");
      setError("API connection failed. Some features may not be available.");
    }
  };

  // Load threads from localStorage
  const loadThreadsFromLocalStorage = () => {
    try {
      const savedThreads = JSON.parse(localStorage.getItem("supportThreads")) || [];
      setThreads(savedThreads);
      setEndedThreads(
        savedThreads.filter((thread) => thread.ended).map((thread) => thread.id)
      );
      if (savedThreads.length > 0 && !currentThreadId) {
        const firstActiveThread = savedThreads.find((thread) => !thread.ended);
        setCurrentThreadId(
          firstActiveThread ? firstActiveThread.id : savedThreads[0].id
        );
      }
    } catch (error) {
      console.error("Error loading threads from localStorage:", error);
      setError("Failed to load conversation history.");
    }
  };

  // Save threads to localStorage
  const saveThreadsToLocalStorage = (updatedThreads) => {
    try {
      localStorage.setItem("supportThreads", JSON.stringify(updatedThreads));
    } catch (error) {
      console.error("Error saving threads to localStorage:", error);
      setError("Failed to save conversation history.");
    }
  };

  // Load messages for the selected thread
  const loadMessagesForThread = (threadId) => {
    try {
      const savedThreads = JSON.parse(localStorage.getItem("supportThreads")) || [];
      const thread = savedThreads.find((t) => t.id === threadId);
      if (thread) {
        setMessages(thread.messages || []);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Error loading messages for thread:", error);
      setError("Failed to load conversation messages.");
    }
  };

  // Create a new support thread
  const createNewThread = async () => {
    if (connectionStatus === "disconnected") {
      setError("Cannot create new thread: API is not available.");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.post("/ai/start");
      const threadName = `Support Thread ${new Date().toLocaleString()}`;
      const newThread = {
        id: response.data.threadId,
        name: threadName,
        messages: [],
        ended: false,
        createdAt: new Date().toISOString(),
      };
      
      const updatedThreads = [newThread, ...threads];
      setThreads(updatedThreads);
      saveThreadsToLocalStorage(updatedThreads);
      setCurrentThreadId(newThread.id);
      setMessages([]);
      
      // Focus on the input field after creating a new thread
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error("Error creating new thread:", error);
      setError("Failed to create new support thread. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a support thread
  const deleteThread = (threadId, event) => {
    event.stopPropagation();
    
    if (confirm("Are you sure you want to delete this conversation?")) {
      const updatedThreads = threads.filter((thread) => thread.id !== threadId);
      setThreads(updatedThreads);
      saveThreadsToLocalStorage(updatedThreads);

      if (currentThreadId === threadId) {
        const nextActiveThread = updatedThreads.find((thread) => !thread.ended);
        setCurrentThreadId(nextActiveThread ? nextActiveThread.id : null);
        setMessages(nextActiveThread ? nextActiveThread.messages : []);
      }

      setEndedThreads(endedThreads.filter((id) => id !== threadId));
    }
  };

  // End the current support conversation
  const endSupport = async () => {
    if (!currentThreadId || connectionStatus === "disconnected") return;

    try {
      setIsLoading(true);
      setError(null);

      // Send the thread for sentiment analysis
      await api.post("/ai/analyze-sentiment", {
        thread: {
          id: currentThreadId,
          name: threads.find((t) => t.id === currentThreadId)?.name || "Ended Thread",
          messages: messages,
        },
      });

      // Add a system message to indicate the thread was ended
      const systemMessage = {
        text: "This support conversation has ended. Thank you for using our service.",
        sender: "system",
        timestamp: new Date().toISOString()
      };
      
      const updatedMessages = [...messages, systemMessage];
      setMessages(updatedMessages);

      // Update local state
      setEndedThreads([...endedThreads, currentThreadId]);

      // Update threads in localStorage
      const updatedThreads = threads.map((thread) =>
        thread.id === currentThreadId 
          ? { ...thread, ended: true, messages: updatedMessages, endedAt: new Date().toISOString() } 
          : thread
      );
      
      setThreads(updatedThreads);
      saveThreadsToLocalStorage(updatedThreads);

      // Switch to the first available active thread
      const nextActiveThread = updatedThreads.find((t) => !t.ended);
      if (nextActiveThread) {
        setCurrentThreadId(nextActiveThread.id);
        setMessages(nextActiveThread.messages || []);
      }
    } catch (error) {
      console.error("Error ending support:", error);
      setError("Failed to end the support conversation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Check if a thread is ended
  const isThreadEnded = (threadId) => endedThreads.includes(threadId);

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (
      inputMessage.trim() === "" ||
      !currentThreadId ||
      isLoading ||
      isThreadEnded(currentThreadId) ||
      connectionStatus === "disconnected"
    )
      return;

    setError(null);
    
    const timestamp = new Date().toISOString();
    const newMessage = { 
      text: inputMessage, 
      sender: "user", 
      timestamp 
    };
    
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputMessage("");
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await api.post("/ai/message", {
        threadId: currentThreadId,
        message: inputMessage,
      });

      setIsTyping(false);
      
      const aiResponse = { 
        text: response.data.response, 
        sender: "ai", 
        timestamp: new Date().toISOString() 
      };
      
      const finalMessages = [...updatedMessages, aiResponse];
      setMessages(finalMessages);

      // Update thread name with first message if this is the first message
      let updatedThreads;
      if (messages.length === 0) {
        updatedThreads = threads.map((thread) =>
          thread.id === currentThreadId
            ? { 
                ...thread, 
                messages: finalMessages,
                name: inputMessage.length > 30 
                  ? inputMessage.substring(0, 30) + "..." 
                  : inputMessage
              }
            : thread
        );
      } else {
        updatedThreads = threads.map((thread) =>
          thread.id === currentThreadId
            ? { ...thread, messages: finalMessages }
            : thread
        );
      }
      
      setThreads(updatedThreads);
      saveThreadsToLocalStorage(updatedThreads);
    } catch (error) {
      console.error("Error sending message:", error);
      setIsTyping(false);
      setError("Failed to send message. Please try again.");
      
      // Add error message to the conversation
      const errorMessage = {
        text: "Sorry, there was an error processing your request. Please try again.",
        sender: "system",
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);
      
      // Update thread in localStorage
      const updatedThreads = threads.map((thread) =>
        thread.id === currentThreadId
          ? { ...thread, messages: finalMessages }
          : thread
      );
      
      setThreads(updatedThreads);
      saveThreadsToLocalStorage(updatedThreads);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Scroll to the bottom of the message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Format date for display
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get thread display name
  const getThreadDisplayName = (thread) => {
    if (!thread) return "";
    
    // If thread has a custom name, use it
    if (thread.name && !thread.name.startsWith("Support Thread")) {
      return thread.name.length > 25 
        ? thread.name.substring(0, 25) + "..." 
        : thread.name;
    }
    
    // Otherwise use first message or default name
    const firstMessage = thread.messages && thread.messages.length > 0 
      ? thread.messages[0].text 
      : null;
      
    if (firstMessage) {
      return firstMessage.length > 25 
        ? firstMessage.substring(0, 25) + "..." 
        : firstMessage;
    }
    
    return thread.name || "New Conversation";
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <main className="container mx-auto py-8 flex-grow flex flex-col md:flex-row">
        {/* Error Alert */}
        {error && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center shadow-md z-50">
            <AlertCircle className="mr-2" size={20} />
            <span>{error}</span>
            <button 
              onClick={() => setError(null)} 
              className="ml-4 text-red-700 hover:text-red-900"
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}

        {/* Connection Status */}
        {connectionStatus === "disconnected" && (
          <div className="w-full bg-yellow-100 text-yellow-800 p-2 text-center mb-4 rounded">
            <span className="flex items-center justify-center">
              <AlertCircle className="mr-2" size={16} />
              API connection is unavailable. Some features may not work.
            </span>
          </div>
        )}

        {/* Sidebar */}
        <div className="w-full md:w-64 bg-white shadow-md rounded-lg md:mr-4 p-4 flex flex-col mb-4 md:mb-0">
          <button
            onClick={createNewThread}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded flex items-center justify-center mb-4 transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
            disabled={isLoading || connectionStatus === "disconnected"}
            aria-label="Create new conversation"
          >
            <Plus size={20} className="mr-2" />
            New Conversation
          </button>
          <div
            className="space-y-2 overflow-y-auto flex-grow"
            style={{ maxHeight: "calc(100vh - 250px)" }}
            role="list"
            aria-label="Conversation threads"
          >
            {threads.length === 0 ? (
              <div className="text-gray-500 text-center p-4">
                No conversations yet. Start a new one!
              </div>
            ) : (
              threads.map((thread) => (
                <div key={thread.id} className="flex items-center" role="listitem">
                  <button
                    onClick={() => setCurrentThreadId(thread.id)}
                    className={`flex-grow text-left p-2 rounded overflow-hidden truncate transition-colors ${
                      currentThreadId === thread.id
                        ? "bg-blue-100 text-blue-800"
                        : "hover:bg-gray-100"
                    } ${thread.ended ? "opacity-75" : ""}`}
                    aria-current={currentThreadId === thread.id ? "true" : "false"}
                  >
                    <div className="font-medium">
                      {getThreadDisplayName(thread)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {thread.messages?.length || 0} messages 
                      {thread.ended ? " · Ended" : ""}
                    </div>
                  </button>
                  <button
                    onClick={(e) => deleteThread(thread.id, e)}
                    className="ml-2 p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                    aria-label={`Delete thread ${getThreadDisplayName(thread)}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div
          className="flex-grow bg-white rounded-lg shadow-md p-6 flex flex-col"
          style={{ maxWidth: "100%", height: "calc(100vh - 200px)" }}
        >
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl md:text-3xl font-bold">Customer Support</h1>
            {currentThreadId && !isThreadEnded(currentThreadId) && (
              <button
                onClick={endSupport}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50"
                disabled={isLoading || connectionStatus === "disconnected"}
                aria-label="End support conversation"
              >
                End Conversation
              </button>
            )}
          </div>

          {!currentThreadId ? (
            <div className="flex-grow flex flex-col items-center justify-center text-gray-500">
              <p className="mb-4 text-center">
                Select a conversation from the sidebar or create a new one.
              </p>
              <button
                onClick={createNewThread}
                className="bg-blue-600 text-white py-2 px-4 rounded flex items-center transition-colors hover:bg-blue-700"
                disabled={isLoading || connectionStatus === "disconnected"}
              >
                <Plus size={20} className="mr-2" />
                New Conversation
              </button>
            </div>
          ) : (
            <>
              <div
                className="flex-grow overflow-y-auto mb-4 space-y-4 p-2"
                style={{ scrollBehavior: "smooth" }}
                role="log"
                aria-label="Message history"
                aria-live="polite"
              >
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 my-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.sender === "user" ? "justify-end" : "justify-start"
                      } ${message.sender === "system" ? "justify-center" : ""}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.sender === "user"
                            ? "bg-blue-600 text-white"
                            : message.sender === "ai"
                            ? "bg-gray-200 text-gray-800"
                            : message.isError
                            ? "bg-red-100 text-red-800 text-sm"
                            : "bg-gray-100 text-gray-600 text-sm"
                        }`}
                        role={message.sender === "system" ? "status" : ""}
                      >
                        {message.text}
                        {message.timestamp && (
                          <div className={`text-xs mt-1 ${
                            message.sender === "user" ? "text-blue-200" : "text-gray-500"
                          }`}>
                            {formatMessageTime(message.timestamp)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="flex justify-start">
                    <TypingIndicator />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    isThreadEnded(currentThreadId)
                      ? "This conversation has ended"
                      : "Type your message here..."
                  }
                  className="flex-grow border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  disabled={
                    isLoading || !currentThreadId || isThreadEnded(currentThreadId) || connectionStatus === "disconnected"
                  }
                  ref={inputRef}
                  aria-label="Message input"
                />
                <button
                  onClick={handleSendMessage}
                  className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                  disabled={
                    isLoading || !currentThreadId || isThreadEnded(currentThreadId) || connectionStatus === "disconnected" || inputMessage.trim() === ""
                  }
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-t-2 border-white border-solid rounded-full animate-spin"></div>
                  ) : (
                    <Send className="h-6 w-6" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CustomerSupportPage;
