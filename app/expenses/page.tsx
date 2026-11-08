'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ExpensesListPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [profilesMap, setProfilesMap] = useState<{ [key: string]: any }>({})
  const [visibleProfiles, setVisibleProfiles] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>('employee')
  const [userFullName, setFullName] = useState<string>('Nil')
  const [loading, setLoading] = useState(true)

  // 篩選 States
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 1. 取得當前登入用戶的 Profile
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role, full_name, department')
        .eq('id', user.id)
        .single()

      if (currentProfile) {
        setUserRole(currentProfile.role)
        if (currentProfile.full_name) setFullName(currentProfile.full_name)

        // 2. 取得所有 Profiles 作為查閱名稱 Mapping
        const { data: profilesData } = await supabase.from('profiles').select('*')
        const map: { [key: string]: any } = {}
        
        if (profilesData) {
          profilesData.forEach(p => { map[p.id] = p })
          setProfilesMap(map)
        }

        // 3. 根據角色進行權限邊界過濾
        let query = supabase.from('expenses').select('*').order('date', { ascending: false })

        if (currentProfile.role === 'employee') {
          // 一般員工：只能看到自己
          query = query.eq('user_id', user.id)
          setVisibleProfiles(profilesData?.filter(p => p.id === user.id) || [])
        } else if (currentProfile.role === 'department_head') {
          // 部門主管：嚴格鎖定只抓取「同部門」員工的 Profiles 與單據
          const deptUsers = profilesData?.filter(p => p.department === currentProfile.department && p.department !== null) || []
          const deptUserIds = deptUsers.map(u => u.id)
          
          setVisibleProfiles(deptUsers)
          query = query.in('user_id', deptUserIds.length > 0 ? deptUserIds : [user.id])
        } else if (currentProfile.role === 'accounting_admin') {
          // 會計主管：看全體
          setVisibleProfiles(profilesData || [])
        }

        const { data, error } = await query
        if (!error && data) {
          setExpenses(data)
        }
      }
      setLoading(false)
    }

    loadData()
  }, [router])

  // 前端條件篩選
  const filteredExpenses = expenses.filter(item => {
    const matchEmp = selectedEmployee === 'all' || item.user_id === selectedEmployee
    const matchCat = selectedCategory === 'all' || item.category === selectedCategory
    return matchEmp && matchCat
  })

  return (
    <main className="max-w-6xl mx-auto p-8 bg-white rounded-2xl shadow-lg mt-10 border border-gray-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Hi，{userFullName}！{userRole === 'department_head' ? ' (部門開支檢視)' : '的報銷記錄'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            身分：<span className="font-semibold text-blue-600">
              {userRole === 'accounting_admin' ? '會計主管 (Admin)' : userRole === 'department_head' ? '部門主管' : '一般員工'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {userRole === 'department_head' && (
            <Link href="/admin" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all">
              ⚙️ 部門審批
            </Link>
          )}
          {userRole === 'accounting_admin' && (
            <>
              <Link href="/admin" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm">
                ⚙️ 審批儀表板
              </Link>
              <Link href="/accounting" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm">
                📊 會計總覽
              </Link>
            </>
          )}
          <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm">
            + 新增報銷
          </Link>
          <button onClick={handleLogout} className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-medium">
            登出
          </button>
        </div>
      </div>

      {/* 篩選工具列：僅針對同部門員工提供篩選 */}
      {userRole !== 'employee' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200/60">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {userRole === 'department_head' ? '依同部門員工篩選' : '依員工篩選'}
            </label>
            <select 
              value={selectedEmployee} 
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-2 text-sm text-gray-800 bg-white"
            >
              <option value="all">全體部門成員 (全部)</option>
              {visibleProfiles.map(p => (
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
              <option value="交通">交通</option>
              <option value="飲食">飲食</option>
              <option value="工具">工具</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div className="flex items-end text-xs text-gray-500 pb-2">
            顯示筆數：<span className="font-bold text-gray-800 ml-1">{filteredExpenses.length}</span> 筆
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500">載入中...</div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-500 text-sm font-medium">沒有找到符合條件的記錄</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 text-gray-600 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4">收據日期</th>
                <th className="p-4">申請人</th>
                <th className="p-4">類別</th>
                <th className="p-4">商戶名稱</th>
                <th className="p-4">金額 (HKD)</th>
                <th className="p-4">收據</th>
                <th className="p-4">審批狀態</th>
                <th className="p-4">批准人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredExpenses.map((item) => {
                const emp = profilesMap[item.user_id] || {}
                const approver = profilesMap[item.approver_id] || {}
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="p-4 text-gray-600 font-medium">{item.date}</td>
                    <td className="p-4 font-bold text-gray-900">{emp.full_name || emp.email || '未知'}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-900">{item.merchant}</td>
                    <td className="p-4 font-bold text-gray-900">${item.amount.toFixed(2)}</td>
                    <td className="p-4">
                      {item.receipt_url ? (
                        <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs bg-blue-50 px-3 py-1 rounded-lg">
                          檢視
                        </a>
                      ) : <span className="text-gray-400 text-xs">無</span>}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                        item.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' : 
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {item.status === 'pending' ? '審核中' : item.status === 'approved' ? '已批准' : '已駁回'}
                      </span>
                    </td>
                    {/* 顯示批准人資訊 */}
                    <td className="p-4 text-xs font-medium text-gray-600">
                      {item.approver_id ? (
                        <span className="text-gray-800 font-semibold">{approver.full_name || approver.email || '系統管理員'}</span>
                      ) : (
                        <span className="text-gray-400">未審核</span>
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