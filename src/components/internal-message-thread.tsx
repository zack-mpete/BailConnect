"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { CheckCheck, MessageCircle, Send } from "lucide-react";
import toast from "react-hot-toast";
import { getSupabaseAccessToken, supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/auth-client";

type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type Conversation = {
  userId: string;
  userName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(part => part[0]?.toUpperCase()).join("") || "U";
}

export function InternalMessageThread({
  houseId,
  recipientId,
  emptyText = "Aucun message pour le moment.",
  title = "Messagerie",
  subtitle = "Conversation interne liee a ce bien."
}: {
  houseId: string;
  recipientId?: string | null;
  emptyText?: string;
  title?: string;
  subtitle?: string;
}) {
  const { user } = useCurrentUser();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(recipientId || null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeRecipientId = recipientId || selectedRecipientId;

  const otherUserName = useMemo(() => {
    const selectedConversation = conversations.find(item => item.userId === activeRecipientId);
    const received = messages.find(item => item.senderId !== user?.id);
    const sent = messages.find(item => item.senderId === user?.id);
    return selectedConversation?.userName || received?.senderName || sent?.recipientName || title || "Interlocuteur";
  }, [activeRecipientId, conversations, messages, title, user?.id]);

  useEffect(() => {
    setSelectedRecipientId(recipientId || null);
  }, [recipientId]);

  useEffect(() => {
    async function loadMessages() {
      if (!supabase || !user || !houseId) {
        setMessages([]);
        setConversations([]);
        return;
      }

      const token = await getSupabaseAccessToken();
      if (!token) return;

      const params = new URLSearchParams({ house: houseId });
      if (activeRecipientId) params.set("recipient", activeRecipientId);
      const res = await fetch(`/api/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!res.ok) return;

      const body = (await res.json()) as { messages?: Message[]; conversations?: Conversation[] };
      const availableConversations = body.conversations || [];
      setConversations(availableConversations);
      if (!recipientId && !activeRecipientId) {
        if (availableConversations[0]) {
          setSelectedRecipientId(availableConversations[0].userId);
          return;
        }
      }

      setMessages(body.messages || []);
    }

    loadMessages();
    const timer = window.setInterval(loadMessages, 20000);
    return () => window.clearInterval(timer);
  }, [activeRecipientId, houseId, recipientId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function sendMessage() {
    const text = message.trim();
    if (!text || !user || !activeRecipientId) return;

    const token = await getSupabaseAccessToken();
    if (!token) {
      toast.error("Connexion requise.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          house_id: houseId,
          recipient_id: activeRecipientId,
          body: text
        })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Message impossible a envoyer.");

      setMessages(current => [...current, body.message]);
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message impossible a envoyer.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    sendMessage();
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-3 py-3 sm:px-4">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-black text-brand-700">
          {initials(otherUserName)}
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-black">{otherUserName}</h2>
          <p className="truncate text-xs font-semibold text-muted">{subtitle}</p>
        </div>
        {!recipientId && conversations.length > 1 && (
          <select
            value={activeRecipientId || ""}
            onChange={event => setSelectedRecipientId(event.target.value)}
            className="order-last w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 sm:order-none sm:w-auto sm:max-w-44"
            aria-label="Choisir une conversation"
          >
            {conversations.map(conversation => (
              <option key={conversation.userId} value={conversation.userId}>
                {conversation.userName}{conversation.unreadCount ? ` (${conversation.unreadCount})` : ""}
              </option>
            ))}
          </select>
        )}
        <MessageCircle className="shrink-0 text-brand-600" size={20} />
      </div>

      <div className="h-[min(420px,55dvh)] min-h-[280px] space-y-4 overflow-y-auto bg-slate-100 px-2 py-4 scrollbar-soft min-[360px]:px-3 md:h-[420px] md:px-5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="max-w-sm rounded-2xl bg-white p-5 shadow-sm">
              <MessageCircle className="mx-auto text-brand-600" size={24} />
              <p className="mt-3 text-sm font-semibold text-muted">{emptyText}</p>
            </div>
          </div>
        ) : (
          messages.map(item => {
            const isMine = item.senderId === user?.id;
            const name = isMine ? user?.fullName : item.senderName || "Utilisateur";

            return (
              <div key={item.id} className={`flex min-w-0 items-end gap-1.5 min-[360px]:gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                {!isMine && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-slate-600 shadow-sm">
                    {initials(name)}
                  </div>
                )}
                <div className={`min-w-0 max-w-[86%] md:max-w-[68%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${isMine ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-white text-slate-800"}`}>
                    {!isMine && <p className="mb-1 text-[11px] font-black text-brand-700">{name}</p>}
                    <p className="break-words whitespace-pre-wrap leading-6 [overflow-wrap:anywhere]">{item.body}</p>
                  </div>
                  <p className={`mt-1 flex items-center gap-1 px-1 text-[11px] font-semibold ${isMine ? "text-right text-slate-500" : "text-muted"}`}>
                    {formatDate(item.createdAt)}
                    {isMine && item.readAt && <CheckCheck size={13} aria-label="Message lu" />}
                  </p>
                </div>
                {isMine && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-black text-white shadow-sm">
                    {initials(user?.fullName)}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-100 bg-white p-3">
        <div className="flex min-w-0 items-end gap-2 rounded-2xl bg-slate-100 p-2">
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!activeRecipientId}
            className="max-h-28 min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-3 text-sm leading-5 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:text-slate-400 sm:px-3"
            placeholder={activeRecipientId ? "Écrire un message..." : "Aucun destinataire disponible pour ce bien."}
          />
          <button
            onClick={sendMessage}
            disabled={!activeRecipientId || !message.trim() || loading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-500 disabled:opacity-50"
            aria-label="Envoyer le message"
          >
            <Send size={17} />
          </button>
        </div>
        <p className="mt-2 px-2 text-[11px] font-semibold text-muted">Entrer pour envoyer, Maj + Entrer pour revenir à la ligne.</p>
      </div>
    </div>
  );
}
