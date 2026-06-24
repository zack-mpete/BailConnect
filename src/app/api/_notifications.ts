import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushSubscription } from "web-push";

type NotifyInput = {
  client: SupabaseClient;
  actorId?: string | null;
  recipientUserIds: string[];
  type: string;
  title: string;
  body: string;
  url?: string;
  metadata?: Record<string, unknown>;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  subscription: PushSubscription;
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@bailconnect.local";

  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function getNotificationClient(fallbackClient: SupabaseClient) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return fallbackClient;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function notifyUsers({ client, actorId, recipientUserIds, type, title, body, url = "/dashboard", metadata = {} }: NotifyInput) {
  const recipients = Array.from(new Set(recipientUserIds.filter(Boolean)));
  if (!recipients.length) return { persisted: 0, sent: 0, failed: 0 };

  const notificationRows = recipients.map(userId => ({
    user_id: userId,
    actor_id: actorId || null,
    type,
    title,
    body,
    url,
    metadata
  }));

  const { error: insertError } = await client.from("notifications").insert(notificationRows);
  if (insertError) {
    return { persisted: 0, sent: 0, failed: 0, error: insertError.message as string };
  }

  const notificationClient = getNotificationClient(client);
  const { data: subscriptions } = await notificationClient
    .from("push_subscriptions")
    .select("id,user_id,subscription")
    .in("user_id", recipients);

  const rows = ((subscriptions || []) as PushSubscriptionRow[]).filter(row => row.subscription?.endpoint);
  if (!configureWebPush()) return { persisted: notificationRows.length, sent: 0, failed: 0, subscriptions: rows.length };

  const payload = JSON.stringify({ title, body, url });
  const results = await Promise.allSettled(rows.map(row => webpush.sendNotification(row.subscription, payload)));

  return {
    persisted: notificationRows.length,
    sent: results.filter(result => result.status === "fulfilled").length,
    failed: results.filter(result => result.status === "rejected").length,
    subscriptions: rows.length
  };
}
