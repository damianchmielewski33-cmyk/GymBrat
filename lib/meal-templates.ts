import { z } from "zod";

/** Max liczba posiłków dziennie definiowanych w profilu. */
export const MAX_MEAL_TEMPLATES = 5;

const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().max(120),
  calories: z.number().finite().min(0),
  proteinG: z.number().finite().min(0),
  fatG: z.number().finite().min(0),
  carbsG: z.number().finite().min(0),
});

export type MealTemplate = z.infer<typeof templateSchema>;

export function parseMealTemplatesJson(raw: string | null | undefined): MealTemplate[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    const out: MealTemplate[] = [];
    for (const item of j) {
      const p = templateSchema.safeParse(item);
      if (p.success) out.push(p.data);
    }
    return out.slice(0, MAX_MEAL_TEMPLATES);
  } catch {
    return [];
  }
}

export function serializeMealTemplates(templates: MealTemplate[]): string | null {
  if (!templates.length) return null;
  return JSON.stringify(templates.slice(0, MAX_MEAL_TEMPLATES));
}

export function defaultMealTemplateName(index: number): string {
  return `Posiłek ${index}`;
}
