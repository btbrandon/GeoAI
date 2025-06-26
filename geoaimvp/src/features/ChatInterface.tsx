"use client";

import React, { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { ScrollArea } from "@/components/scroll-area";
import { Avatar, AvatarFallback } from "@/components/avatar";
import { Send, Bot, User } from "lucide-react";
import { cn, ChatInterfacePropsWithUserMessage } from "@/lib/utils";

export default function ChatInterface({
  onResponse,
  pins,
  referencePoint,
  chatEvents = [],
  onUserMessage,
}: ChatInterfacePropsWithUserMessage) {
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
    const last = messages[messages.length - 1];

    if (
      last?.role === "assistant" &&
      last.id !== lastProcessedMessageId.current &&
      !isLoading
    ) {
      lastProcessedMessageId.current = last.id;
      onResponse({
        id: last.id,
        content: last.content,
        role: "assistant",
        timestamp: new Date().toISOString(),
      });
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
      <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-y-auto">
        <div role="log" className="space-y-1 pb-4">
          {chatEvents.map((evt, idx) => {
            const isUser = evt.role === "user";
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  isUser ? "flex-row-reverse" : undefined
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
                  {evt.content}
                  <time className="block text-xs mt-1 opacity-70">
                    {new Date(evt.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-2">
        {pins.length > 0 && (
          <div className="mb-2 p-2 bg-blue-50  rounded text-xs text-blue-700">
            📍 {pins.length} pin{pins.length > 1 ? "s" : ""} available for
            spatial operations
          </div>
        )}
        {referencePoint && (
          <div className=" p-2 bg-green-50 rounded text-xs text-green-700">
            🎯 Reference point set at ({referencePoint.latitude.toFixed(4)},{" "}
            {referencePoint.longitude.toFixed(4)})
          </div>
        )}
      </div>

      <footer className="border-t py-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (onUserMessage) onUserMessage(input);
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
