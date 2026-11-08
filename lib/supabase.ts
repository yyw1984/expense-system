import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 導出共用的 supabase 客戶端實例
export const supabase = createClient(supabaseUrl, supabaseAnonKey)