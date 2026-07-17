import type { Contract, House, Payment } from "@/types";
import mockJson from "../../public/api.json";

export type MockData = {
  users: Array<{ id: string; name: string; role: string; phone: string; verified: boolean }>;
  houses: House[];
  contracts: Contract[];
  payments?: Payment[];
  stats: { houses: number; contracts: number; users: number };
};

export async function getMockData(): Promise<MockData> {
  return mockJson as MockData;
}
