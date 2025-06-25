"use client";

import React, { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
}

interface TypingIndicatorProps {
  isVisible: boolean;
}

function TypingIndicator({ isVisible }: TypingIndicatorProps) {
  if (!isVisible) return null;
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-muted text-muted-foreground">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center space-x-1 bg-muted rounded-2xl px-4 py-3">
        <div className="flex space-x-1">
          <div className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
}

interface ChatBubbleProps {
  message: Message;
}

function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3", // shared container
        isUser ? "flex-row-reverse" : "" // reverse for user
      )}
    >
      {/* avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* the actual “bubble” */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground ml-auto"
            : "bg-muted text-muted-foreground"
        )}
      >
        {message.content}
        {message.timestamp && (
          <time
            className="block text-xs mt-1 opacity-70"
            dateTime={message.timestamp}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        )}
      </div>
    </div>
  );
}

interface ChatInterfaceProps {
  onResponse: (message: Message) => void;
}

export default function ChatInterface({ onResponse }: ChatInterfaceProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/llm",
      onResponse: async (res) => {
        const data = await res.json();
        const msg = data.choices?.[0]?.message;
        if (msg) {
          onResponse({
            id: Date.now().toString(),
            content: msg.content || "",
            role: msg.role as "assistant",
            timestamp: new Date().toISOString(),
          });
        }
      },
    });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-background">
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div
          role="log"
          aria-label="Chat conversation"
          aria-live="polite"
          className="space-y-1 pb-4"
        >
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={{
                id: message.id,
                content: message.content,
                role:
                  message.role === "system" || message.role === "data"
                    ? "assistant"
                    : message.role,
                timestamp: new Date().toISOString(),
              }}
            />
          ))}
          <TypingIndicator isVisible={isLoading} />
        </div>
      </ScrollArea>
      <footer className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <label htmlFor="message-input" className="sr-only">
              Type your message
            </label>
            <Input
              id="message-input"
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="min-h-[44px] rounded-2xl border px-4 py-3 text-sm focus:border-primary"
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 rounded-2xl"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </footer>
    </div>
  );
}
