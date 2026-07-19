import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.E2E_ADMIN_EMAIL &&
  process.env.E2E_ADMIN_PASSWORD &&
  process.env.E2E_LANDLORD_EMAIL &&
  process.env.E2E_LANDLORD_PASSWORD &&
  process.env.E2E_TENANT_EMAIL &&
  process.env.E2E_TENANT_PASSWORD
);

async function tokenFor(email, password) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error || new Error("Session de test absente.");
  return data.session.access_token;
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

test("publication, demande, contrat et résiliation immédiate", async ({ request }) => {
  test.skip(!configured, "Comptes E2E ou configuration Supabase absents.");

  const [adminToken, landlordToken, tenantToken] = await Promise.all([
    tokenFor(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD),
    tokenFor(process.env.E2E_LANDLORD_EMAIL, process.env.E2E_LANDLORD_PASSWORD),
    tokenFor(process.env.E2E_TENANT_EMAIL, process.env.E2E_TENANT_PASSWORD)
  ]);

  const unique = Date.now();
  let houseId;

  try {
    const createResponse = await request.post("/api/houses", {
      headers: headers(landlordToken),
      data: {
        title: `E2E Maison ${unique}`,
        description: "Annonce créée automatiquement pour vérifier le workflow complet.",
        city: "Kinshasa",
        commune: "Gombe",
        district: "Gombe",
        price: 500,
        rooms: 3,
        type: "Maison",
        features: ["Test E2E"],
        contract_duration_months: 12
      }
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();
    houseId = created.house.id;
    expect(created.house.is_valid).toBe(false);

    const publicPendingDetail = await request.get(`/api/houses/${houseId}`);
    expect(publicPendingDetail.status()).toBe(404);

    const ownerPendingDetail = await request.get(`/api/houses/${houseId}`, {
      headers: headers(landlordToken)
    });
    expect(ownerPendingDetail.status()).toBe(200);
    expect((await ownerPendingDetail.json()).house.id).toBe(houseId);

    const ownerDashboard = await request.get("/api/dashboard", {
      headers: headers(landlordToken)
    });
    expect(ownerDashboard.status()).toBe(200);
    expect((await ownerDashboard.json()).houses.some(house => house.id === houseId)).toBe(true);

    let catalog = await (await request.get("/api/houses")).json();
    expect(catalog.houses.some(house => house.id === houseId)).toBe(false);

    const approveResponse = await request.patch(`/api/houses/${houseId}`, {
      headers: headers(adminToken),
      data: { action: "approve" }
    });
    expect(approveResponse.status()).toBe(200);
    expect((await approveResponse.json()).house.is_valid).toBe(true);

    catalog = await (await request.get("/api/houses")).json();
    expect(catalog.houses.some(house => house.id === houseId)).toBe(true);

    const requestResponse = await request.post("/api/rental-requests", {
      headers: headers(tenantToken),
      data: { house_id: houseId, message: "Demande E2E" }
    });
    expect(requestResponse.status()).toBe(201);
    const rentalRequestId = (await requestResponse.json()).id;

    const acceptResponse = await request.patch(`/api/rental-requests/${rentalRequestId}`, {
      headers: headers(landlordToken),
      data: { action: "accept" }
    });
    expect(acceptResponse.status()).toBe(200);
    const contractId = (await acceptResponse.json()).contractId;
    expect(contractId).toBeTruthy();

    catalog = await (await request.get("/api/houses")).json();
    expect(catalog.houses.some(house => house.id === houseId)).toBe(false);

    const adminAgreement = await request.patch("/api/contracts", {
      headers: headers(adminToken),
      data: { contract_id: contractId, action: "agree" }
    });
    expect(adminAgreement.status()).toBe(403);

    const adminContractEdit = await request.patch(`/api/houses/${houseId}`, {
      headers: headers(adminToken),
      data: {
        action: "update_contract_terms",
        contract_duration_months: 24,
        contract_title: "Modification administrateur interdite"
      }
    });
    expect(adminContractEdit.status()).toBe(403);

    const ownerAgreement = await request.patch("/api/contracts", {
      headers: headers(landlordToken),
      data: { contract_id: contractId, action: "agree" }
    });
    expect(ownerAgreement.status()).toBe(200);
    expect((await ownerAgreement.json()).contract.status).toBe("pret_a_signer");

    const tenantAgreement = await request.patch("/api/contracts", {
      headers: headers(tenantToken),
      data: { contract_id: contractId, action: "agree" }
    });
    expect(tenantAgreement.status()).toBe(200);
    expect((await tenantAgreement.json()).contract.status).toBe("signe");

    const archiveResponse = await request.patch(`/api/houses/${houseId}`, {
      headers: headers(adminToken),
      data: { action: "archive" }
    });
    expect(archiveResponse.status()).toBe(200);
    const archivedHouse = (await archiveResponse.json()).house;
    expect(archivedHouse.is_archived).toBe(true);
    expect(archivedHouse.status).toBe("Loué");

    const termination = await request.patch("/api/contracts", {
      headers: headers(tenantToken),
      data: {
        contract_id: contractId,
        action: "request_termination",
        effective_date: new Date().toISOString().slice(0, 10),
        reason: "Fin du test automatisé"
      }
    });
    expect(termination.status()).toBe(200);
    expect((await termination.json()).contract.status).toBe("resilie");

    catalog = await (await request.get("/api/houses")).json();
    expect(catalog.houses.some(house => house.id === houseId)).toBe(false);

    const restoreResponse = await request.patch(`/api/houses/${houseId}`, {
      headers: headers(adminToken),
      data: { action: "restore" }
    });
    expect(restoreResponse.status()).toBe(200);
    expect((await restoreResponse.json()).house.is_archived).toBe(false);

    catalog = await (await request.get("/api/houses")).json();
    expect(catalog.houses.some(house => house.id === houseId)).toBe(true);
  } finally {
    if (houseId) {
      await request.delete(`/api/houses/${houseId}`, {
        headers: headers(adminToken)
      });
    }
  }
});
