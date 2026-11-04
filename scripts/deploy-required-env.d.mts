export type RequiredEnvGroup = {
  id: string;
  label: string;
  names: string[];
  validate?: (value: string) => boolean;
};
export const REQUIRED_PRODUCTION_ENV: RequiredEnvGroup[];
export function missingProductionEnv(
  env: Record<string, string | undefined>,
): Array<{ id: string; label: string; missing: string[] }>;
export function parseEnvFile(text: string): Record<string, string>;
