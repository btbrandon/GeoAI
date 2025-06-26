import { CoreMessage } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
}

export interface ChatInterfaceProps {
  onResponse: (message: Message) => void;
}

export interface Pin {
  id: string;
  longitude: number;
  latitude: number;
  coordinates: [number, number];
}
export interface ExtendedChatInterfaceProps extends ChatInterfaceProps {
  pins: Pin[];
  referencePoint?: Pin | null;
  chatEvents?: {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }[];
}

export interface MapComponentProps {
  pins: Pin[];
  setPins: React.Dispatch<React.SetStateAction<Pin[]>>;
  mapData?: any;
  lastSpatialOp?: string | null;
}

export interface ReferencePoint {
  id: string;
  longitude: number;
  latitude: number;
  coordinates: [number, number];
}

export interface LLMRequestBody {
  messages: CoreMessage[];
  pins?: Pin[];
  referencePoint?: ReferencePoint;
}

export interface LLMOperation {
  op: string;
  params: Record<string, unknown>;
}

export interface ChatInterfacePropsWithUserMessage
  extends ExtendedChatInterfaceProps {
  onUserMessage?: (text: string) => void;
}
