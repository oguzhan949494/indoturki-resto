import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Tek bir Supabase client örneği - tüm client bileşenlerinde tekrar kullanılır.
// Bu projede henüz tip-güvenli bir Supabase Database şeması üretilmedi,
// bu yüzden generic'ler "any" bırakılıyor - aksi halde yeni supabase-js
// sürümleri insert/update sorgularını "never" tipine indirger.
let client: ReturnType<typeof createSupabaseClient<any, any, any>> | null = null;

export function createClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase ortam değişkenleri eksik. .env.local dosyasında " +
        "NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY (veya NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) tanımlı olmalı."
    );
  }

  client = createSupabaseClient<any, any, any>(supabaseUrl, supabaseAnonKey);
  return client;
}
