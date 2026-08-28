export type DbCategory = {
  id: string;
  name_tr: string;
  name_id: string;
  emoji: string | null;
  sort_order: number;
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
};

export type Category = {
  id: string;
  nameTr: string;
  nameId: string;
  emoji: string;
  sortOrder: number;
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
};

export type CartLine = {
  product: Product;
  quantity: number;
  note: string;
};

export const ALL_CATEGORY_ID = "__all__";

export function mapCategories(rows: DbCategory[] | null): Category[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    nameTr: row.name_tr,
    nameId: row.name_id,
    emoji: row.emoji ?? "🍽️",
    sortOrder: row.sort_order,
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
