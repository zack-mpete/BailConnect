import type { Contract, House } from "@/types";
import mockJson from "../../public/api.json";

export type MockData = {
  users: Array<{ id: string; name: string; role: string; phone: string; verified: boolean }>;
  houses: House[];
  contracts: Contract[];
  stats: { houses: number; contracts: number; users: number; pendingRequests: number };
};

export async function getMockData(): Promise<MockData> {
  return mockJson as MockData;
}
