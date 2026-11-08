'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert('登入失敗: ' + error.message)
    } else {
      router.push('/') // 登入成功後跳轉回報銷提交頁
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50/50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-gray-100 p-8 border border-gray-100">
        
        {/* 標題與簡介 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mb-4 font-bold text-xl">
            💼
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Alpha MedTech Limited</h1>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">員工報銷系統</h1>
          <p className="text-sm text-gray-500 mt-1">請登入您的帳號以繼續操作</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              電子郵件
            </label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="name@company.com"
              required 
              className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              密碼
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
              className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-medium text-sm shadow-sm hover:shadow transition-all disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>登入中...</span>
              </>
            ) : (
              <span>登入系統</span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-gray-400">
          Enterprise Expense Management System
        </div>
      </div>
    </main>
  )
}