'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AccountingPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // 篩選條件 States
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  
  // 💡 新增：多選勾選的記錄 ID 集合
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [updating, setUpdating] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    async function loadAccountingData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 1. 檢查當前用戶是否為會計主管
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'accounting_admin') {
        alert('您沒有會計管理員權限')
        router.push('/expenses')
        return
      }

      // 2. 取得所有員工 Profiles
      const { data: profilesData } = await supabase.from('profiles').select('*')
      setProfiles(profilesData || [])

      // 3. 取得所有報銷紀錄
      const { data: expensesData, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })

      if (error) {
        console.error('讀取失敗:', error.message)
      } else if (expensesData) {
        // 💡 雙重重複檢測邏輯
        const expensesWithDuplicateCheck = expensesData.map(item => {
          const isDuplicate = expensesData.some(other => {
            if (other.id === item.id) return false

            const sameDate = other.date === item.date
            const sameMerchant = 
              other.merchant && item.merchant &&
              other.merchant.trim().toLowerCase() === item.merchant.trim().toLowerCase()
            const matchMerchantRule = sameDate && sameMerchant

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

    loadAccountingData()
  }, [router])

  // 建立對應 Map
  const profilesMap: { [key: string]: any } = {}
  profiles.forEach(p => { profilesMap[p.id] = p })

  // 取得所有出現過的月份清單
  const availableMonths = Array.from(
    new Set(expenses.map(item => item.date ? item.date.slice(0, 7) : ''))
  ).filter(Boolean).sort().reverse()

  // 篩選邏輯
  const filteredExpenses = expenses.filter(item => {
    const matchEmployee = selectedEmployee === 'all' || item.user_id === selectedEmployee
    const matchCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchMonth = selectedMonth === 'all' || (item.date && item.date.startsWith(selectedMonth))
    const matchStatus = selectedStatus === 'all' || item.status === selectedStatus
    return matchEmployee && matchCategory && matchMonth && matchStatus
  })

  // 💡 處理單一勾選 / 取消勾選
  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  // 💡 處理全選 / 取消全選（針對當前篩選結果）
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allFilteredIds = filteredExpenses.map(item => item.id)
      setSelectedIds(allFilteredIds)
    } else {
      setSelectedIds([])
    }
  }

  // 💡 批核所選項目為「已發出支票」
  const handleBatchIssueCheck = async () => {
    if (selectedIds.length === 0) return

    const confirmMsg = `確定要將選取的 ${selectedIds.length} 筆報銷單狀態更新為「已發出支票」嗎？`
    if (!confirm(confirmMsg)) return

    setUpdating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('expenses')
        .update({ 
          status: 'cheque_issued', // 儲存至資料庫的狀態值
          approver_id: user?.id 
        })
        .in('id', selectedIds)

      if (error) {
        alert('更新失敗: ' + error.message)
      } else {
        alert('成功更新所選單據狀態為「已發出支票」！')
        setSelectedIds([]) // 清空勾選
        // 重新載入頁面資料
        window.location.reload()
      }
    } catch (err: any) {
      console.error(err)
      alert('發生未預期錯誤')
    } finally {
      setUpdating(false)
    }
  }

  // 匯出 CSV 函式
  const exportToCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('目前沒有符合條件的資料可供匯出')
      return
    }

    const headers = ['收據日期', '員工姓名', '部門', '類別', '商戶名稱', '金額 (HKD)', '申請備註', '填寫方式', '審批狀態', '批准人', '是否疑似重複']
    
    const rows = filteredExpenses.map(item => {
      const emp = profilesMap[item.user_id] || {}
      const approver = profilesMap[item.approver_id] || {}
      let statusText = '審核中'
      if (item.status === 'approved') statusText = '已批准'
      else if (item.status === 'rejected') statusText = '已駁回'
      else if (item.status === 'cheque_issued') statusText = '已發出支票'

      const editTypeText = item.is_manually_edited ? '人工覆核' : 'AI 自動辨識'
      const duplicateText = item.isDuplicate ? '是' : '否'
      
      return [
        item.date,
        `"${emp.full_name || emp.email || '未知'}"`,
        `"${emp.department || '未分配'}"`,
        `"${item.category}"`,
        `"${item.merchant}"`,
        item.amount.toFixed(2),
        `"${item.notes || ''}"`,
        `"${editTypeText}"`,
        `"${statusText}"`,
        `"${approver.full_name || approver.email || '未審核'}"`,
        `"${duplicateText}"`
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `expense_report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <main className="max-w-7xl mx-auto p-8 bg-white rounded-2xl shadow-lg mt-10 border border-gray-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">會計總覽與匯出中心</h1>
          <p className="text-sm text-gray-500 mt-1">檢視全公司員工報銷明細與審批結果，提供多維度篩選與會計報表匯出</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={exportToCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-1.5"
          >
            📥 匯出 CSV 報表
          </button>
          <Link href="/expenses" className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 transition-all">
            返回個人清單
          </Link>
        </div>
      </div>

      {/* 篩選工具列 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200/60">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">依員工篩選</label>
          <select 
            value={selectedEmployee} 
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">全體員工 (全部)</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email} ({p.department || '未分部門'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">依類別篩選</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">所有類別 (全部)</option>
            <option value="交通">交通</option>
            <option value="飲食">飲食</option>
            <option value="工具">工具</option>
            <option value="其他">其他</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">依收據月份篩選</label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">所有月份 (全部)</option>
            {availableMonths.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">依審批狀態篩選</label>
          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-2 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">所有狀態 (全部)</option>
            <option value="pending">審核中</option>
            <option value="approved">已批准</option>
            <option value="cheque_issued">已發出支票</option>
            <option value="rejected">已駁回</option>
          </select>
        </div>
      </div>

      {/* 💡 批核操作控制列 (當有勾選時顯示) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 px-1 gap-3">
        <div className="text-xs text-gray-500">
          符合條件筆數：<span className="font-bold text-gray-800">{filteredExpenses.length}</span> 筆 
          {selectedIds.length > 0 && (
            <span className="ml-3 text-blue-600 font-semibold">
              已勾選：{selectedIds.length} 筆
            </span>
          )}
        </div>

        {selectedIds.length > 0 && (
          <button
            onClick={handleBatchIssueCheck}
            disabled={updating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:bg-gray-300"
          >
            {updating ? '處理中...' : `💳 將所選 ${selectedIds.length} 筆標記為「已發出支票」`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-sm text-gray-500 font-medium">載入中...</span>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <p className="text-center py-16 text-gray-500 text-sm font-medium">沒有找到符合條件的報銷紀錄</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 text-gray-600 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4 w-10 text-center">
                  <input 
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={filteredExpenses.length > 0 && selectedIds.length === filteredExpenses.length}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="p-4">收據日期</th>
                <th className="p-4">員工姓名</th>
                <th className="p-4">部門</th>
                <th className="p-4">類別</th>
                <th className="p-4">商戶名稱與填寫狀態</th>
                <th className="p-4">金額 (HKD)</th>
                <th className="p-4">申請備註</th>
                <th className="p-4">收據證明</th>
                <th className="p-4">審批狀態</th>
                <th className="p-4">批准人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredExpenses.map((item) => {
                const emp = profilesMap[item.user_id] || {}
                const approver = profilesMap[item.approver_id] || {}
                const isChecked = selectedIds.includes(item.id)

                return (
                  <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${isChecked ? 'bg-blue-50/40' : ''}`}>
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleSelectOne(item.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-4 text-gray-600 font-medium">{item.date}</td>
                    <td className="p-4 font-semibold text-gray-900">{emp.full_name || emp.email || '未知員工'}</td>
                    <td className="p-4 text-gray-600">{emp.department || '未分配'}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{item.merchant}</div>
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
                        {item.isDuplicate && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                            ⚠️ 疑似重複申報
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-gray-900">${item.amount.toFixed(2)}</td>
                    <td className="p-4 text-xs text-gray-600 max-w-[160px] truncate" title={item.notes || ''}>
                      {item.notes ? item.notes : <span className="text-gray-400">無</span>}
                    </td>
                    <td className="p-4">
                      {item.receipt_url ? (
                        <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                          查看收據
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">無</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200/50' :
                        item.status === 'cheque_issued' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50 font-bold' :
                        item.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200/50' : 
                        'bg-amber-50 text-amber-700 border border-amber-200/50'
                      }`}>
                        {item.status === 'pending' ? '審核中' : 
                         item.status === 'approved' ? '已批准' : 
                         item.status === 'cheque_issued' ? '💳 已發出支票' : '已駁回'}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-medium text-gray-600">
                      {item.approver_id ? (
                        <span className="text-gray-800 font-semibold">{approver.full_name || approver.email || '管理員'}</span>
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