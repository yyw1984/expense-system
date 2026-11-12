'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminApprovalPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [profilesMap, setProfilesMap] = useState<{ [key: string]: any }>({})
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // 篩選 States
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const router = useRouter()

  const loadExpenses = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setCurrentUser(user)

    // 取得當前登入者的 Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'accounting_admin' && profile.role !== 'department_head')) {
      alert('您沒有權限訪問此頁面')
      router.push('/expenses')
      return
    }
    setCurrentUserProfile(profile)

    // 取得所有 profiles
    const { data: profilesData } = await supabase.from('profiles').select('*')
    if (profilesData) {
      setAllProfiles(profilesData)
      const map: { [key: string]: any } = {}
      profilesData.forEach(p => { map[p.id] = p })
      setProfilesMap(map)
    }

    // 取得報銷單據
    let query = supabase.from('expenses').select('*').order('date', { ascending: false })

    if (profile.role === 'department_head') {
      const deptEmployees = profilesData?.filter(p => p.department === profile.department && p.role === 'employee') || []
      const userIds = deptEmployees.map(u => u.id)
      
      query = query.in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
    }

    const { data, error } = await query
    if (!error && data) {
      // 💡 雙重重複檢測邏輯：
      // 條件 A：日期相同 且 商戶名稱相同
      // 條件 B：日期相同 且 金額相同
      const expensesWithDuplicateCheck = data.map(item => {
        const isDuplicate = data.some(other => {
          if (other.id === item.id) return false

          const sameDate = other.date === item.date
          
          // 邏輯 1：日期相同 + 商戶名稱相同 (忽略大小寫與前後空白)
          const sameMerchant = 
            other.merchant && item.merchant &&
            other.merchant.trim().toLowerCase() === item.merchant.trim().toLowerCase()
          const matchMerchantRule = sameDate && sameMerchant

          // 邏輯 2：日期相同 + 金額相同
          const sameAmount = other.amount === item.amount
          const matchAmountRule = sameDate && sameAmount

          return matchMerchantRule || matchAmountRule
        })

        return { ...item, isDuplicate }
      })

      setExpenses(expensesWithDuplicateCheck)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadExpenses()
  }, [router])

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!currentUser) return

    const { error } = await supabase
      .from('expenses')
      .update({ 
        status: newStatus,
        approver_id: currentUser.id 
      })
      .eq('id', id)

    if (error) {
      alert('更新失敗: ' + error.message)
    } else {
      loadExpenses()
    }
  }

  // 篩選邏輯
  const filteredExpenses = expenses.filter(item => {
    const matchEmp = selectedEmployee === 'all' || item.user_id === selectedEmployee
    const matchCat = selectedCategory === 'all' || item.category === selectedCategory
    return matchEmp && matchCat
  })

  const dropdownProfiles = currentUserProfile?.role === 'department_head'
    ? allProfiles.filter(p => p.department === currentUserProfile.department && p.role === 'employee')
    : allProfiles

  return (
    <main className="max-w-7xl mx-auto p-8 bg-white rounded-2xl shadow-lg mt-10 border border-gray-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">審批儀表板</h1>
          <p className="text-sm text-gray-500 mt-1">
            {currentUserProfile?.role === 'department_head' 
              ? '審核本部門一般員工提交的報銷單據（主管本人單據由會計主管審批）' 
              : '管理與審核全公司所有報銷與部門主管單據'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentUserProfile?.role === 'accounting_admin' && (
            <Link href="/admin/import" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
              📥 批量匯入員工
            </Link>
          )}
          <Link href="/expenses" className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200">
            ← 返回個人清單
          </Link>
        </div>
      </div>

      {/* 篩選工具列 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200/60">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">依員工篩選</label>
          <select 
            value={selectedEmployee} 
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-2 text-sm text-gray-800 bg-white"
          >
            <option value="all">可審批成員 (全部)</option>
            {dropdownProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">依類別篩選</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-2 text-sm text-gray-800 bg-white"
          >
            <option value="all">所有類別 (全部)</option>
            <option value="飲食">飲食</option>
            <option value="交通">交通</option>
            <option value="工具">工具</option>
            <option value="文具">文具</option>
            <option value="Inventory">Inventory</option>
            <option value="Car Expense">Car Expense</option>
            <option value="Business Trip">Business Trip</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div className="flex items-end text-xs text-gray-500 pb-2">
          待審批筆數：<span className="font-bold text-gray-800 ml-1">{filteredExpenses.length}</span> 筆
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">載入中...</div>
      ) : filteredExpenses.length === 0 ? (
        <p className="text-center py-16 text-gray-500 text-sm font-medium">目前沒有需要您審批的報銷單據</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                <th className="p-4">日期</th>
                <th className="p-4">申請人</th>
                <th className="p-4">類別</th>
                <th className="p-4">商戶與辨識狀態</th>
                <th className="p-4">金額</th>
                <th className="p-4">申請備註</th>
                <th className="p-4">收據</th>
                <th className="p-4">狀態</th>
                <th className="p-4">操作 / 批准人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredExpenses.map((item) => {
                const emp = profilesMap[item.user_id] || {}
                const approver = profilesMap[item.approver_id] || {}
                const isSelf = currentUser && item.user_id === currentUser.id

                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-gray-600 font-medium">{item.date}</td>
                    <td className="p-4 font-bold text-gray-900">{emp.full_name || emp.email || '未知'}</td>
                    <td className="p-4">{item.category}</td>
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{item.merchant}</div>
                      <div className="mt-1 flex flex-wrap gap-1 items-center">
                        {item.is_manually_edited ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                            ✏️ 人工覆核
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                            🤖 AI 自動辨識
                          </span>
                        )}
                        {/* 💡 雙重條件重複單據警示標籤 */}
                        {item.isDuplicate && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                            ⚠️ 疑似重複申報
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-bold">${item.amount.toFixed(2)}</td>
                    <td className="p-4 text-xs text-gray-600 max-w-[160px] truncate" title={item.notes || ''}>
                      {item.notes ? item.notes : <span className="text-gray-400">無</span>}
                    </td>
                    <td className="p-4">
                      {item.receipt_url ? (
                        <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs underline">
                          檢視
                        </a>
                      ) : '無'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'approved' ? 'bg-green-50 text-green-700' :
                        item.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {item.status === 'pending' ? '審核中' : item.status === 'approved' ? '已批准' : '已駁回'}
                      </span>
                    </td>
                    <td className="p-4">
                      {isSelf ? (
                        <span className="text-xs text-gray-400 italic">（不可審核自己的單據）</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleUpdateStatus(item.id, 'approved')}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all"
                            >
                              批准
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(item.id, 'rejected')}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all"
                            >
                              駁回
                            </button>
                          </div>
                          {item.approver_id && (
                            <span className="text-[11px] text-gray-500 font-medium">
                              批准人：{approver.full_name || approver.email || '主管'}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}