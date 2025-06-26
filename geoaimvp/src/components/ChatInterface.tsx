"use client";

import React, { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User } from "lucide-react";
import { cn, ChatInterfaceProps } from "@/lib/utils";

interface Pin {
  id: string;
  longitude: number;
  latitude: number;
  coordinates: [number, number];
}

interface ExtendedChatInterfaceProps extends ChatInterfaceProps {
  pins: Pin[];
  referencePoint?: Pin | null;
}

export default function ChatInterface({
  onResponse,
  pins,
  referencePoint,
}: ExtendedChatInterfaceProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/llm",
      body: {
        pins: pins,
        referencePoint: referencePoint,
      },
    });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastProcessedMessageId = useRef<string | null>(null);

  useEffect(() => {
    console.log("ChatInterface - All messages:", messages);
    const last = messages[messages.length - 1];
    console.log("ChatInterface - Last message:", last);
    console.log("ChatInterface - Last message role:", last?.role);
    console.log("ChatInterface - Last message content:", last?.content);

    // Only process if we have a complete assistant message that we haven't processed yet
    if (
      last?.role === "assistant" &&
      last.id !== lastProcessedMessageId.current &&
      !isLoading
    ) {
      console.log("ChatInterface - Calling onResponse with:", last);
      lastProcessedMessageId.current = last.id;
      onResponse({
        id: last.id,
        content: last.content,
        role: "assistant",
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log(
        "ChatInterface - Skipping onResponse (already processed or still loading)"
      );
    }
  }, [messages, onResponse, isLoading]);

  useEffect(() => {
    const container = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-background">
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div role="log" className="space-y-1 pb-4">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  isUser && "flex-row-reverse"
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className={cn(
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isUser ? <User /> : <Bot />}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm whitespace-pre-wrap",
                    isUser
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {m.content}
                  <time className="block text-xs mt-1 opacity-70">
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex items-start gap-3 px-4 py-3">
              {/* your TypingIndicator here */}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-2">
        {/* Show pin status */}
        {pins.length > 0 && (
          <div className="mb-2 p-2 bg-blue-50  rounded text-xs text-blue-700">
            📍 {pins.length} pin{pins.length > 1 ? "s" : ""} available for
            spatial operations
          </div>
        )}
        {/* Show reference point status */}
        {referencePoint && (
          <div className="mb-2 p-2 bg-green-50 rounded text-xs text-green-700">
            🎯 Reference point set at ({referencePoint.latitude.toFixed(4)},{" "}
            {referencePoint.longitude.toFixed(4)})
          </div>
        )}
      </div>

      <footer className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex items-end gap-2"
        >
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="flex-1 min-h-[44px] rounded-2xl border px-4 py-3 text-sm"
            disabled={isLoading}
          />
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
