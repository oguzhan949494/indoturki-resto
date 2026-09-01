"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Choice = {
  id: string;
  option_group_id: string;
  name_tr: string;
  name_id: string;
  price_delta: number;
  price_delta_percent: number | null;
  is_default: boolean;
  sort_order: number;
};

type Group = {
  id: string;
  name_tr: string;
  name_id: string;
  type: "single" | "multiple" | "checklist_remove";
  sort_order: number;
};

type CategoryRow = {
  id: string;
  name_tr: string;
  emoji: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  single: "Tekli Seçim (radyo)",
  multiple: "Çoklu Seçim (checkbox)",
  checklist_remove: "Çıkarılabilir Liste (varsayılan hepsi dahil)",
};

export default function SeceneklerPage() {
  const supabase = createClient();
  const [groups, setGroups] = useState<Group[]>([]);
  const [choicesByGroup, setChoicesByGroup] = useState<Record<string, Choice[]>>({});
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [assignedByGroup, setAssignedByGroup] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [yeniGrupAcik, setYeniGrupAcik] = useState(false);
  const [yeniGrup, setYeniGrup] = useState({ name_tr: "", name_id: "", type: "single" as const });

  const veriYukle = useCallback(async () => {
    setLoading(true);
    const [{ data: groupRows }, { data: choiceRows }, { data: categoryRows }, { data: linkRows }] =
      await Promise.all([
        supabase.from("option_groups").select("*").order("sort_order"),
        supabase.from("option_choices").select("*").order("sort_order"),
        supabase.from("categories").select("id, name_tr, emoji").eq("section", "menu").order("sort_order"),
        supabase.from("category_option_groups").select("category_id, option_group_id"),
      ]);

    setGroups((groupRows as Group[]) ?? []);
    setCategories((categoryRows as CategoryRow[]) ?? []);

    const grouped: Record<string, Choice[]> = {};
    for (const c of (choiceRows as Choice[]) ?? []) {
      if (!grouped[c.option_group_id]) grouped[c.option_group_id] = [];
      grouped[c.option_group_id].push(c);
    }
    setChoicesByGroup(grouped);

    const assigned: Record<string, Set<string>> = {};
    for (const link of linkRows ?? []) {
      const gid = (link as any).option_group_id;
      if (!assigned[gid]) assigned[gid] = new Set();
      assigned[gid].add((link as any).category_id);
    }
    setAssignedByGroup(assigned);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    veriYukle();
  }, [veriYukle]);

  const grupOlustur = async () => {
    if (!yeniGrup.name_tr.trim()) {
      alert("Grup adı zorunludur.");
      return;
    }
    await supabase.from("option_groups").insert({
      name_tr: yeniGrup.name_tr.trim(),
      name_id: yeniGrup.name_id.trim() || yeniGrup.name_tr.trim(),
      type: yeniGrup.type,
      sort_order: groups.length * 10 + 10,
    });
    setYeniGrupAcik(false);
    setYeniGrup({ name_tr: "", name_id: "", type: "single" });
    veriYukle();
  };

  const grupSil = async (group: Group) => {
    if (!window.confirm(`"${group.name_tr}" grubu ve içindeki tüm seçenekler silinsin mi?`)) return;
    await supabase.from("option_groups").delete().eq("id", group.id);
    veriYukle();
  };

  const secenekEkle = async (groupId: string) => {
    const mevcut = choicesByGroup[groupId] ?? [];
    await supabase.from("option_choices").insert({
      option_group_id: groupId,
      name_tr: "Yeni Seçenek",
      name_id: "Pilihan Baru",
      price_delta: 0,
      is_default: false,
      sort_order: mevcut.length * 10 + 10,
    });
    veriYukle();
  };

  const secenekGuncelle = async (choice: Choice, patch: Partial<Choice>) => {
    setChoicesByGroup((current) => ({
      ...current,
      [choice.option_group_id]: (current[choice.option_group_id] ?? []).map((c) =>
        c.id === choice.id ? { ...c, ...patch } : c
      ),
    }));
    await supabase.from("option_choices").update(patch).eq("id", choice.id);
  };

  const secenekSil = async (choice: Choice) => {
    await supabase.from("option_choices").delete().eq("id", choice.id);
    veriYukle();
  };

  const kategoriAtamasiDegistir = async (groupId: string, categoryId: string, atanmis: boolean) => {
    if (atanmis) {
      await supabase.from("category_option_groups").delete().match({
        option_group_id: groupId,
        category_id: categoryId,
      });
    } else {
      await supabase
        .from("category_option_groups")
        .insert({ option_group_id: groupId, category_id: categoryId });
    }
    veriYukle();
  };

  return (
    <main className="min-h-screen bg-[#f3f1ed] text-[#231710]">
      <header className="sticky top-0 z-20 border-b border-[#e2ddd3] bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-xl font-black">Seçenek Yönetimi</h1>
            <p className="text-xs text-[#7a6f63]">
              Ürün seçeneklerini (porsiyon, malzeme çıkarma vb.) buradan yönet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYeniGrupAcik(true)}
              className="rounded-full bg-[#ef2b1e] px-4 py-2 text-xs font-bold text-white"
            >
              + Yeni Seçenek Grubu
            </button>
            <Link
              href="/admin"
              className="rounded-full border border-[#e2ddd3] px-4 py-2 text-xs font-bold text-[#5b4032]"
            >
              ← Panele Dön
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
        {loading ? (
          <p className="text-center font-bold text-[#7a6f63]">Yükleniyor...</p>
        ) : groups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#d8cfc0] bg-white p-10 text-center font-bold text-[#7a6f63]">
            Henüz seçenek grubu yok. "+ Yeni Seçenek Grubu" ile başla.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="rounded-2xl border border-[#e2ddd3] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-black">{group.name_tr}</div>
                    <div className="text-xs text-[#a18b7b]">{TYPE_LABEL[group.type]}</div>
                  </div>
                  <button
                    onClick={() => grupSil(group)}
                    className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600"
                  >
                    Grubu Sil
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {(choicesByGroup[group.id] ?? []).map((choice) => (
                    <div
                      key={choice.id}
                      className="space-y-1.5 rounded-xl border border-[#eee7db] p-2"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          defaultValue={choice.name_tr}
                          onBlur={(e) => secenekGuncelle(choice, { name_tr: e.target.value })}
                          placeholder="Ad (TR)"
                          className="rounded-lg border border-[#e5d4c2] px-2 py-1.5 text-xs font-bold"
                        />
                        <input
                          defaultValue={choice.name_id}
                          onBlur={(e) => secenekGuncelle(choice, { name_id: e.target.value })}
                          placeholder="Ad (ID)"
                          className="rounded-lg border border-[#e5d4c2] px-2 py-1.5 text-xs font-bold"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            defaultValue={choice.price_delta}
                            onBlur={(e) =>
                              secenekGuncelle(choice, { price_delta: Number(e.target.value) || 0 })
                            }
                            placeholder="Sabit fark"
                            className="w-24 rounded-lg border border-[#e5d4c2] px-2 py-1.5 text-xs font-bold"
                          />
                          <span className="text-[10px] font-bold text-[#a18b7b]">₺</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#a18b7b]">veya</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            defaultValue={choice.price_delta_percent ?? ""}
                            onBlur={(e) =>
                              secenekGuncelle(choice, {
                                price_delta_percent:
                                  e.target.value.trim() === "" ? null : Number(e.target.value),
                              })
                            }
                            placeholder="Yüzde"
                            className="w-20 rounded-lg border border-[#e5d4c2] px-2 py-1.5 text-xs font-bold"
                          />
                          <span className="text-[10px] font-bold text-[#a18b7b]">
                            % (ürün fiyatına göre)
                          </span>
                        </div>
                        <label className="ml-auto flex items-center gap-1 text-[10px] font-bold text-[#7a6f63]">
                          <input
                            type="checkbox"
                            checked={choice.is_default}
                            onChange={(e) =>
                              secenekGuncelle(choice, { is_default: e.target.checked })
                            }
                            className="h-3.5 w-3.5"
                          />
                          Varsayılan
                        </label>
                        <button
                          onClick={() => secenekSil(choice)}
                          className="rounded-full border border-red-300 px-2 py-1 text-[10px] font-bold text-red-600"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => secenekEkle(group.id)}
                    className="w-full rounded-xl border border-dashed border-[#d8cfc0] py-2 text-xs font-bold text-[#7a6f63]"
                  >
                    + Seçenek Ekle
                  </button>
                </div>

                <div className="mt-3 border-t border-[#eee7db] pt-3">
                  <p className="mb-2 text-[11px] font-black uppercase text-[#a18b7b]">
                    Hangi kategorilerde gösterilsin?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => {
                      const atanmis = assignedByGroup[group.id]?.has(cat.id) ?? false;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => kategoriAtamasiDegistir(group.id, cat.id, atanmis)}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                            atanmis
                              ? "bg-[#ef2b1e] text-white"
                              : "border border-[#e5d4c2] text-[#5b4032]"
                          }`}
                        >
                          {cat.emoji} {cat.name_tr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {yeniGrupAcik && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <h3 className="mb-4 text-lg font-black">Yeni Seçenek Grubu</h3>
            <div className="space-y-3">
              <input
                value={yeniGrup.name_tr}
                onChange={(e) => setYeniGrup((g) => ({ ...g, name_tr: e.target.value }))}
                placeholder="Grup adı (Türkçe) *"
                className="w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm"
              />
              <input
                value={yeniGrup.name_id}
                onChange={(e) => setYeniGrup((g) => ({ ...g, name_id: e.target.value }))}
                placeholder="Grup adı (Endonezce) — boşsa Türkçesi kullanılır"
                className="w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm"
              />
              <select
                value={yeniGrup.type}
                onChange={(e) => setYeniGrup((g) => ({ ...g, type: e.target.value as any }))}
                className="w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm"
              >
                <option value="single">Tekli Seçim (radyo)</option>
                <option value="multiple">Çoklu Seçim (checkbox)</option>
                <option value="checklist_remove">Çıkarılabilir Liste (varsayılan hepsi dahil)</option>
              </select>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setYeniGrupAcik(false)}
                className="flex-1 rounded-2xl border border-[#e4d3c1] py-3 text-sm font-bold"
              >
                Vazgeç
              </button>
              <button
                onClick={grupOlustur}
                className="flex-1 rounded-2xl bg-[#231710] py-3 text-sm font-black text-white"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
