export type DbCategory = {
  id: string;
  name_tr: string;
  name_id: string;
  emoji: string | null;
  sort_order: number;
  section: string | null;
};

export type DbProduct = {
  id: string;
  category_id: string;
  name_tr: string;
  name_id: string;
  description_tr: string | null;
  description_id: string | null;
  price_tl: number;
  spicy_level: number | null;
  is_new: boolean | null;
  is_available: boolean;
  sort_order: number;
  image_url: string | null;
  section: string | null;
  stock_quantity: number | null;
};

export type Category = {
  id: string;
  nameTr: string;
  nameId: string;
  emoji: string;
  sortOrder: number;
  section: "menu" | "market";
};

export type Product = {
  id: string;
  categoryId: string;
  nameTr: string;
  nameId: string;
  descriptionTr: string;
  descriptionId: string;
  price: number;
  spicy: number;
  isNew: boolean;
  imageUrl: string | null;
  isAvailable: boolean;
  section: "menu" | "market";
  stockQuantity: number | null;
  sortOrder: number;
};

export type NoodleType = "noodle150" | "mix" | "bihun150";

export type CartLine = {
  product: Product;
  quantity: number;
  note: string;
  sambal: boolean;
  extraPilav: boolean;
  extraNoodle: boolean;
  noodleType: NoodleType | null;
  dynamicSelections: Record<string, string[]>;
};

export const ALL_CATEGORY_ID = "__all__";

export function mapCategories(rows: DbCategory[] | null): Category[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    nameTr: row.name_tr,
    nameId: row.name_id,
    emoji: row.emoji ?? "🍽️",
    sortOrder: row.sort_order,
    section: row.section === "market" ? "market" : "menu",
  }));
}

export function mapProducts(rows: DbProduct[] | null): Product[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    nameTr: row.name_tr,
    nameId: row.name_id,
    descriptionTr: row.description_tr ?? "",
    descriptionId: row.description_id ?? "",
    price: Number(row.price_tl),
    spicy: row.spicy_level ?? 0,
    isNew: row.is_new ?? false,
    imageUrl: row.image_url ?? null,
    isAvailable: row.is_available ?? true,
    section: row.section === "market" ? "market" : "menu",
    stockQuantity: row.stock_quantity ?? null,
    sortOrder: row.sort_order,
  }));
}

export const formatTL = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);

export const formatIDR = (value: number) =>
  `Rp ${value.toLocaleString("id-ID")}`;

export function generateOrderNumber() {
  return Math.floor(100000 + Math.random() * 900000);
}

// --- Ürün başına ek seçenekler (sambal, ekstra pilav, ekstra noodle) ---

export const EXTRA_ADDON_PRICE = 50;

// Kategori adına bakarak "rice bowl" mi "noodle" mü olduğunu anlar.
// Kategori isimlerinde İngilizce "Bowl" / "Noodle" kelimeleri geçtiği için
// bu basit kontrol yeterli (bkz. seed.sql'deki kategori adları).
export function categoryAllowsExtraPilav(categoryNameTr: string) {
  return categoryNameTr.toLowerCase().includes("bowl");
}

export function categoryAllowsExtraNoodle(categoryNameTr: string) {
  return categoryNameTr.toLowerCase().includes("noodle");
}

// İçecek kategorileri (Coffee & Tea, Mixed Drinks, Soft Drinks) için
// sambal sos seçeneği anlamsız, bu kategorilerde gösterilmiyor.
export function categoryIsBeverage(categoryNameTr: string) {
  const n = categoryNameTr.toLowerCase();
  return n.includes("coffee") || n.includes("tea") || n.includes("drink");
}

// Bakso ürünlerinde (Mie Ayam & Bakso kategorisi), noodle/bihun türü
// tek seçimli (radio) olarak seçilebiliyor.
export function categoryAllowsNoodleTypeChoice(categoryNameTr: string) {
  return categoryNameTr.toLowerCase().includes("bakso");
}

// Bir sepet satırının, seçilen eklentilerle birlikte birim fiyatı.
export function lineUnitPrice(
  line: CartLine,
  categoryOptionGroups?: Record<string, { id: string; choices: { id: string; priceDelta: number }[] }[]>
): number {
  let price = line.product.price;
  if (line.extraPilav) price += EXTRA_ADDON_PRICE;
  if (line.extraNoodle) price += EXTRA_ADDON_PRICE;

  if (categoryOptionGroups) {
    const groups = categoryOptionGroups[line.product.categoryId] ?? [];
    for (const group of groups) {
      const selected = line.dynamicSelections?.[group.id] ?? [];
      for (const choiceId of selected) {
        const choice = group.choices.find((c) => c.id === choiceId);
        if (choice) price += choice.priceDelta;
      }
    }
  }

  return price;
}

// Sipariş kaydedilirken order_items.options alanına yazılacak kodlar.
export function lineOptionCodes(line: CartLine): string[] {
  const codes: string[] = [];
  if (line.sambal) codes.push("sambal");
  if (line.extraPilav) codes.push("extra_pilav");
  if (line.extraNoodle) codes.push("extra_noodle");
  if (line.noodleType) codes.push(line.noodleType);
  return codes;
}

export const OPTION_LABELS: Record<string, { tr: string; id: string }> = {
  sambal: { tr: "🌶️ Sambal sos", id: "🌶️ Sambal" },
  extra_pilav: { tr: "🍚 Ekstra Pilav (150g) +50₺", id: "🍚 Tambah Nasi (150g) +50₺" },
  extra_noodle: { tr: "🍜 Ekstra Noodle (75g) +50₺", id: "🍜 Tambah Mie (75g) +50₺" },
  noodle150: { tr: "🍜 Noodle 150gr", id: "🍜 Mie 150gr" },
  mix: { tr: "🍜 Noodle 75gr & Bihun 75gr", id: "🍜 Mie 75gr & Bihun 75gr" },
  bihun150: { tr: "🍜 Bihun 150gr", id: "🍜 Bihun 150gr" },
};
