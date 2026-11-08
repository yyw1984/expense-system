'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      alert('密碼修改失敗: ' + error.message)
    } else {
      alert('密碼修改成功！請重新登入')
      await supabase.auth.signOut()
      router.push('/login')
    }
    setLoading(false)
  }

  return (
    <main className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md mt-20">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-800">修改登入密碼</h1>
        <Link href="/expenses" className="text-sm text-blue-600 hover:underline">返回清單</Link>
      </div>
      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">新密碼</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            placeholder="請輸入至少 6 位數新密碼"
            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-black"
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium"
        >
          {loading ? '更新中...' : '確認修改密碼'}
        </button>
      </form>
    </main>
  )
}