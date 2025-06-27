"use client";

import { useChat } from "@ai-sdk/react";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { ScrollArea } from "../components/scroll-area";
import { StructuredChatInterfaceProps } from "@/lib/utils";

export default function StructuredChatInterface({
  pins,
  referencePoint,
  onMapDataUpdate,
  onSpatialOpUpdate,
}: StructuredChatInterfaceProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/structured-llm",
      body: {
        pins,
        referencePoint,
      },
      onFinish: (message) => {
        if (message.parts && message.parts.length > 0) {
          const toolInvocationPart = message.parts.find(
            (part) => part.type === "tool-invocation"
          );

          if (toolInvocationPart && "toolInvocation" in toolInvocationPart) {
            const toolInvocation = (toolInvocationPart as any).toolInvocation;

            if (toolInvocation.state === "result" && toolInvocation.result) {
              const result = toolInvocation.result as any;
              if (result.mapData) {
                onMapDataUpdate(result.mapData);
                onSpatialOpUpdate(toolInvocation.toolName);
              }
            }
          }
        }
      },
    });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    onMapDataUpdate(null);
    onSpatialOpUpdate("");

    handleSubmit(e);
  };

  return (
    <div className="flex flex-col h-full max-w-md bg-white border-l border-gray-200">
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-lg font-semibold">GeoAI MVP</h2>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {message.content && <p>{message.content}</p>}

                  {message.parts && message.parts.length > 0 && (
                    <div className="mt-2">
                      {message.parts
                        .filter((part) => part.type === "tool-invocation")
                        .map((toolPart, toolIndex) => {
                          const toolInvocationPart = toolPart as any;
                          if (
                            toolInvocationPart.toolInvocation &&
                            toolInvocationPart.toolInvocation.state === "result"
                          ) {
                            const toolInvocation =
                              toolInvocationPart.toolInvocation;
                            return (
                              <div key={toolIndex} className="text-xs">
                                {toolInvocation.result && (
                                  <div>
                                    <strong>
                                      Operation: {toolInvocation.toolName}
                                    </strong>
                                    <p className="mt-1">
                                      {(toolInvocation.result as any)
                                        .explanation ||
                                        "Operation completed successfully"}
                                    </p>
                                    {(toolInvocation.result as any).count && (
                                      <p className="mt-1">
                                        Found:{" "}
                                        {(toolInvocation.result as any).count}{" "}
                                        points
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })}
                    </div>
                  )}

                  <p className="text-xs opacity-70 mt-1">
                    {new Date(
                      message.createdAt || Date.now()
                    ).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 px-3 py-2 rounded-lg text-sm">
                  <p>Processing...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <form
        onSubmit={onSubmit}
        className="p-4 border-t border-gray-200 flex-shrink-0"
      >
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="e.g. within 5 km, nearest 3, buffer 2km"
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            Send
          </Button>
        </div>
      </form>

      <div className="p-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-600 flex-shrink-0">
        <p>
          <strong>Available operations:</strong>
        </p>
        <ul className="list-disc list-inside ml-2">
          <li>
            <strong>within X km</strong> - Find points within distance
          </li>
          <li>
            <strong>nearest X</strong> - Find k nearest points
          </li>
          <li>
            <strong>buffer X km</strong> - Create buffer around pins
          </li>
        </ul>
        <div className="mt-2">
          Pins: {pins.length} | Reference: {referencePoint ? "Set" : "None"}
        </div>
      </div>
    </div>
  );
}
