// Genel, admin panelinden yönetilebilir ürün seçenek sistemi.
// Mevcut sambal/ekstra pilav/ekstra noodle/noodle tipi seçeneklerine
// dokunmuyor — bu, Rice/Noodle Bowl gibi YENİ eklenen özellikler için.

export type OptionGroupType = "single" | "multiple" | "checklist_remove";

export type OptionChoice = {
  id: string;
  nameTr: string;
  nameId: string;
  priceDelta: number;
  isDefault: boolean;
  sortOrder: number;
};

export type OptionGroup = {
  id: string;
  nameTr: string;
  nameId: string;
  type: OptionGroupType;
  sortOrder: number;
  choices: OptionChoice[];
};

// Bir kategorinin sahip olduğu tüm seçenek gruplarını (seçenekleriyle
// birlikte) tek seferde çeker. Dönen değer: categoryId -> OptionGroup[].
export async function loadCategoryOptionGroups(
  supabase: any
): Promise<Record<string, OptionGroup[]>> {
  const [{ data: links }, { data: groups }, { data: choices }] = await Promise.all([
    supabase.from("category_option_groups").select("category_id, option_group_id"),
    supabase.from("option_groups").select("id, name_tr, name_id, type, sort_order").order("sort_order"),
    supabase
      .from("option_choices")
      .select("id, option_group_id, name_tr, name_id, price_delta, is_default, sort_order")
      .order("sort_order"),
  ]);

  const groupById = new Map<string, OptionGroup>();
  for (const g of groups ?? []) {
    groupById.set(g.id, {
      id: g.id,
      nameTr: g.name_tr,
      nameId: g.name_id,
      type: g.type,
      sortOrder: g.sort_order,
      choices: [],
    });
  }

  for (const c of choices ?? []) {
    const group = groupById.get(c.option_group_id);
    if (group) {
      group.choices.push({
        id: c.id,
        nameTr: c.name_tr,
        nameId: c.name_id,
        priceDelta: Number(c.price_delta),
        isDefault: c.is_default,
        sortOrder: c.sort_order,
      });
    }
  }

  const result: Record<string, OptionGroup[]> = {};
  for (const link of links ?? []) {
    const group = groupById.get(link.option_group_id);
    if (!group) continue;
    if (!result[link.category_id]) result[link.category_id] = [];
    result[link.category_id].push(group);
  }
  for (const catId in result) {
    result[catId].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return result;
}

// Bir grup için varsayılan seçili seçenek ID'lerini döner
// (is_default=true olan tüm seçenekler).
export function defaultSelectionFor(group: OptionGroup): string[] {
  return group.choices.filter((c) => c.isDefault).map((c) => c.id);
}

// Seçili seçeneklerin toplam fiyat farkını hesaplar.
export function dynamicOptionsPriceDelta(
  groups: OptionGroup[],
  selections: Record<string, string[]>
): number {
  let total = 0;
  for (const group of groups) {
    const selected = selections[group.id] ?? [];
    for (const choiceId of selected) {
      const choice = group.choices.find((c) => c.id === choiceId);
      if (choice) total += choice.priceDelta;
    }
  }
  return total;
}

// Sipariş kaydına yazılacak, gösterime hazır satırları üretir.
// - single/multiple: seçili olanlar gösterilir.
// - checklist_remove: sadece KALDIRILANLAR ("... hariç") gösterilir.
export function buildDynamicOptionLines(
  groups: OptionGroup[],
  selections: Record<string, string[]>,
  lang: "tr" | "id"
): { label: string; priceDelta: number }[] {
  const lines: { label: string; priceDelta: number }[] = [];
  for (const group of groups) {
    const selected = selections[group.id] ?? [];
    if (group.type === "checklist_remove") {
      const removed = group.choices.filter((c) => !selected.includes(c.id));
      for (const c of removed) {
        const name = lang === "tr" ? c.nameTr : c.nameId;
        lines.push({
          label: lang === "tr" ? `${name} hariç` : `Tanpa ${name}`,
          priceDelta: 0,
        });
      }
    } else {
      for (const choiceId of selected) {
        const choice = group.choices.find((c) => c.id === choiceId);
        if (!choice) continue;
        const name = lang === "tr" ? choice.nameTr : choice.nameId;
        lines.push({
          label: choice.priceDelta !== 0 ? `${name} (${choice.priceDelta > 0 ? "+" : ""}${choice.priceDelta}₺)` : name,
          priceDelta: choice.priceDelta,
        });
      }
    }
  }
  return lines;
}
