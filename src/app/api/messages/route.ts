import { NextRequest, NextResponse } from "next/server";
import { notifyUsers } from "@/app/api/_notifications";
import { apiError, getApiClient } from "@/app/api/_supabase";
import { houseContractsHref, houseManagerHref } from "@/lib/house-links";

type HouseRow = {
  id: string;
  owner_id: string;
  title: string;
};

type MessageRow = {
  id: string;
  house_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type UserNameRow = {
  id: string;
  full_name: string;
};

const messageSelect = "id,house_id,sender_id,recipient_id,body,read_at,created_at";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && uuidPattern.test(value));
}

async function getUserNames(client: NonNullable<ReturnType<typeof getApiClient>["client"]>, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, string>();

  const { data } = await client.from("users").select("id,full_name").in("id", uniqueIds);
  return new Map(((data || []) as UserNameRow[]).map(user => [user.id, user.full_name]));
}

async function getHouse(client: NonNullable<ReturnType<typeof getApiClient>["client"]>, houseId: string) {
  const { data, error } = await client
    .from("houses")
    .select("id,owner_id,title")
    .eq("id", houseId)
    .single();

  if (error || !data) return null;
  return data as HouseRow;
}

async function canOwnerMessageRecipient(
  client: NonNullable<ReturnType<typeof getApiClient>["client"]>,
  houseId: string,
  ownerId: string,
  recipientId: string
) {
  const [contractResult, messageResult] = await Promise.all([
    client
      .from("contracts")
      .select("id")
      .eq("house_id", houseId)
      .eq("owner_id", ownerId)
      .eq("tenant_id", recipientId)
      .limit(1)
      .maybeSingle(),
    client
      .from("messages")
      .select("id")
      .eq("house_id", houseId)
      .eq("sender_id", recipientId)
      .eq("recipient_id", ownerId)
      .limit(1)
      .maybeSingle()
  ]);

  return Boolean(contractResult.data || messageResult.data);
}

function serializeMessages(rows: MessageRow[], names: Map<string, string>) {
  return rows.map(row => ({
    id: row.id,
    houseId: row.house_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    senderName: names.get(row.sender_id) || "Utilisateur",
    recipientName: names.get(row.recipient_id) || "Utilisateur",
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at
  }));
}

function serializeConversations(rows: MessageRow[], names: Map<string, string>, viewerId: string) {
  const latestByUser = new Map<string, MessageRow>();
  const unreadByUser = new Map<string, number>();

  for (const row of rows) {
    const otherUserId = row.sender_id === viewerId ? row.recipient_id : row.sender_id;
    latestByUser.set(otherUserId, row);
    if (row.recipient_id === viewerId && !row.read_at) {
      unreadByUser.set(otherUserId, (unreadByUser.get(otherUserId) || 0) + 1);
    }
  }

  return Array.from(latestByUser.entries())
    .map(([userId, lastMessage]) => ({
      userId,
      userName: names.get(userId) || "Utilisateur",
      lastMessage: lastMessage.body,
      lastMessageAt: lastMessage.created_at,
      unreadCount: unreadByUser.get(userId) || 0
    }))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export async function GET(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const houseId = req.nextUrl.searchParams.get("house");
  const recipientId = req.nextUrl.searchParams.get("recipient");
  if (!isUuid(houseId)) return apiError("Maison invalide.");
  if (recipientId && !isUuid(recipientId)) return apiError("Destinataire invalide.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const house = await getHouse(client, houseId);
  if (!house) return apiError("Maison introuvable.", 404);

  let query = client
    .from("messages")
    .select(messageSelect)
    .eq("house_id", houseId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (recipientId) {
    query = query.or(
      `and(sender_id.eq.${authData.user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${authData.user.id})`
    );
  } else {
    query = query.or(`sender_id.eq.${authData.user.id},recipient_id.eq.${authData.user.id}`);
  }

  const { data, error: readError } = await query;
  if (readError) return apiError(readError.message, 400);

  const rows = ((data || []) as MessageRow[]).reverse();
  let conversationRows = rows;

  if (recipientId) {
    await client.rpc("mark_messages_read", {
      target_house_id: houseId,
      other_user_id: recipientId
    });

    const { data: conversationData } = await client
      .from("messages")
      .select(messageSelect)
      .eq("house_id", houseId)
      .or(`sender_id.eq.${authData.user.id},recipient_id.eq.${authData.user.id}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (conversationData) conversationRows = (conversationData as MessageRow[]).reverse();
  }

  const names = await getUserNames(
    client,
    [...rows, ...conversationRows].flatMap(row => [row.sender_id, row.recipient_id])
  );

  return NextResponse.json({
    messages: serializeMessages(rows, names),
    conversations: serializeConversations(conversationRows, names, authData.user.id)
  });
}

export async function POST(req: NextRequest) {
  const { client, error } = getApiClient(req);
  if (!client) return error;

  const payload = await req.json().catch(() => null) as {
    house_id?: string;
    body?: string;
    recipient_id?: string;
  } | null;
  const houseId = payload?.house_id;
  const messageBody = payload?.body?.trim();
  if (!isUuid(houseId) || !messageBody) return apiError("Maison et message requis.");
  if (messageBody.length > 2000) return apiError("Message trop long.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return apiError("Connexion requise.", 401);

  const house = await getHouse(client, houseId);
  if (!house) return apiError("Maison introuvable.", 404);

  const senderId = authData.user.id;
  const isOwner = senderId === house.owner_id;
  const recipientId = isOwner ? payload?.recipient_id : house.owner_id;
  if (!isUuid(recipientId)) return apiError("Destinataire invalide.");
  if (recipientId === senderId) return apiError("Impossible de s'envoyer un message.");

  if (isOwner && !(await canOwnerMessageRecipient(client, house.id, senderId, recipientId))) {
    return apiError("Le propriétaire ne peut écrire qu'à un utilisateur lié à cette maison.", 403);
  }

  const { data, error: insertError } = await client
    .from("messages")
    .insert({
      house_id: house.id,
      sender_id: senderId,
      recipient_id: recipientId,
      body: messageBody
    })
    .select(messageSelect)
    .single();

  if (insertError || !data) return apiError(insertError?.message || "Message impossible à envoyer.", 400);

  await notifyUsers({
    client,
    actorId: senderId,
    recipientUserIds: [recipientId],
    type: "internal_message",
    title: "Nouveau message",
    body: messageBody,
    url: isOwner ? houseContractsHref(house.id) : houseManagerHref(house.id, "messages"),
    metadata: { house_id: house.id, message_id: (data as MessageRow).id }
  });

  const names = await getUserNames(client, [senderId, recipientId]);
  const [message] = serializeMessages([data as MessageRow], names);
  return NextResponse.json({ message }, { status: 201 });
}
