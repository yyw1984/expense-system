'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function BatchImportPage() {
  const [loading, setLoading] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [logMessage, setLogMessage] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'accounting_admin' && profile.role !== 'department_head')) {
        alert('您沒有權限訪問此頁面')
        router.push('/expenses')
      }
    }
    checkAdmin()
  }, [router])

  // 處理批量匯入邏輯
  const handleBatchImport = async () => {
    if (!csvText.trim()) {
      alert('請輸入或貼上要匯入的 CSV 資料')
      return
    }

    setLoading(true)
    setLogMessage([])
    const logs: string[] = []

    try {
      const lines = csvText.trim().split('\n')
      // 假設格式為：email, full_name, role, department
      // 例如：alex@example.com, 陳大文, department_head, 業務部
      
      let successCount = 0
      let failCount = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // 略過標題行（如果包含 email 字樣）
        if (i === 0 && line.toLowerCase().includes('email')) {
          logs.push(`ℹ️ 略過標題行: ${line}`)
          continue
        }

        const parts = line.split(',').map(p => p.trim())
        if (parts.length < 4) {
          logs.push(`❌ 第 ${i + 1} 行格式錯誤（欄位不足 4 個）: ${line}`)
          failCount++
          continue
        }

        const [email, full_name, role, department] = parts

        // 檢查角色是否合法
        const validRoles = ['employee', 'department_head', 'accounting_admin']
        if (!validRoles.includes(role)) {
          logs.push(`❌ ${email}: 角色 '${role}' 無效（必須為 employee, department_head 或 accounting_admin）`)
          failCount++
          continue
        }

        // 依據 email 尋找並更新 profiles 表
        const { data: existingUser, error: findError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single()

        if (findError || !existingUser) {
          logs.push(`❌ ${email}: 找不到此帳號，請確保員工已先註冊系統`)
          failCount++
          continue
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name,
            role,
            department
          })
          .eq('id', existingUser.id)

        if (updateError) {
          logs.push(`❌ ${email} 更新失敗: ${updateError.message}`)
          failCount++
        } else {
          logs.push(`✅ ${email} 成功更新（姓名: ${full_name}, 角色: ${role}, 部門: ${department}）`)
          successCount++
        }
      }

      logs.push(`\n🎉 匯入完成！成功：${successCount} 筆，失敗：${failCount} 筆`)
    } catch (err: any) {
      logs.push(`💥 發生未預期錯誤: ${err.message}`)
    } finally {
      setLogMessage(logs)
      setLoading(false)
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-lg mt-10 border border-gray-100">
      <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">批量匯入與更新員工資料</h1>
          <p className="text-sm text-gray-500 mt-1">快速批量設定員工姓名、角色與所屬部門</p>
        </div>
        <Link href="/admin" className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200">
          ← 返回審批儀表板
        </Link>
      </div>

      <div className="mb-6 bg-blue-50/60 p-4 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-1">
        <p className="font-semibold text-blue-900">📌 使用說明與格式規範：</p>
        <p>1. 請確保員工已透過系統完成註冊（會在 profiles 自動生成記錄）。</p>
        <p>2. 每行輸入一筆資料，欄位順序為：<code className="bg-white px-1.5 py-0.5 rounded border border-blue-200">Email, 姓名, 角色, 部門</code></p>
        <p>3. 可用角色代碼：<code className="bg-white px-1.5 py-0.5 rounded border border-blue-200">employee</code> (員工) | <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200">department_head</code> (部門主管) | <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200">accounting_admin</code> (會計主管)</p>
        <p className="font-mono mt-2 text-gray-700">範例：<br/>user1@example.com, 陳大文, department_head, 業務部<br/>user2@example.com, 李小美, employee, 技術部</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">貼上 CSV 資料</label>
          <textarea 
            rows={8}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="email, full_name, role, department..."
            className="w-full rounded-xl border border-gray-200 p-3 text-sm font-mono text-gray-800 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <button 
          onClick={handleBatchImport}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-medium text-sm shadow-sm transition-all disabled:bg-gray-300"
        >
          {loading ? '處理中...' : '開始批量匯入 / 更新'}
        </button>
      </div>

      {logMessage.length > 0 && (
        <div className="mt-8 p-4 bg-gray-900 text-gray-100 rounded-xl font-mono text-xs space-y-1 max-h-60 overflow-y-auto">
          <p className="text-gray-400 font-bold mb-2">📋 執行結果記錄：</p>
          {logMessage.map((log, idx) => (
            <div key={idx}>{log}</div>
          ))}
        </div>
      )}
    </main>
  )
}