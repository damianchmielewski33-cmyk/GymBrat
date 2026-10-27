import type { ProgressHubData } from "@/lib/progress-hub";

export type ProgressTabData = {
  przeglad: Pick<ProgressHubData, "intelligence" | "body" | "week">;
  sila: Pick<ProgressHubData, "strength" | "intelligence">;
  sylwetka: Pick<ProgressHubData, "body">;
  tydzien: Pick<ProgressHubData, "week" | "intelligence">;
};

export type ProgressTabPayload = {
  [K in keyof ProgressTabData]: { tab: K; data: ProgressTabData[K] }
}[keyof ProgressTabData];
