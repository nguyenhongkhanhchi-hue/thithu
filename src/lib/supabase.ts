import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as
  | string
  | undefined;
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

/** true nếu đã cấu hình Supabase; false → dùng Local Mode */
export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseUrl !== "your_supabase_url" &&
  supabaseKey &&
  supabaseKey !== "your_supabase_anon_key"
);

// Tạo real client chỉ khi có cấu hình đầy đủ
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createNullClient();

/**
 * Fake Supabase client để app không crash khi chạy Local Mode.
 * Tất cả các method đều trả về kết quả rỗng / thành công giả.
 */
function createNullClient(): SupabaseClient {
  const noop = () => ({});
  const nullQuery = {
    select: () => nullQuery,
    from: () => nullQuery,
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
    eq: () => nullQuery,
    neq: () => nullQuery,
    gt: () => nullQuery,
    lt: () => nullQuery,
    gte: () => nullQuery,
    lte: () => nullQuery,
    order: () => nullQuery,
    limit: () => nullQuery,
    single: () => Promise.resolve({ data: null, error: null }),
    then: (cb: any) => Promise.resolve({ data: null, error: null }).then(cb),
  };

  return {
    from: () => nullQuery as any,
    rpc: () => Promise.resolve({ data: null, error: null }) as any,
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
      }),
    } as any,
    functions: {
      invoke: () =>
        Promise.resolve({
          data: null,
          error: { message: "Local mode: Supabase not configured" },
        }),
    } as any,
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: (_event: any, _cb: any) => ({
        data: { subscription: { unsubscribe: noop } },
      }),
      signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
      signInWithPassword: () =>
        Promise.resolve({ data: { user: null, session: null }, error: null }),
      signUp: () =>
        Promise.resolve({ data: { user: null, session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ data: { user: null }, error: null }),
      verifyOtp: () =>
        Promise.resolve({ data: { user: null, session: null }, error: null }),
      resetPasswordForEmail: () => Promise.resolve({ data: {}, error: null }),
      setSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
    } as any,
    channel: () => ({ on: () => ({}), subscribe: () => ({}) }) as any,
    removeChannel: noop as any,
  } as unknown as SupabaseClient;
}
