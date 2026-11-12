'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NewExpensePage() {
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('') 
  const [category, setCategory] = useState('飲食')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  
  // 登入者資訊 State
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null)

  const [uploading, setUploading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrMessage, setOcrMessage] = useState('')

  const [hasEdited, setHasEdited] = useState(false)
  
  const router = useRouter()

  // 初始化載入日期與當前使用者基本資料
  useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10))

    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profile) {
        setCurrentUserProfile(profile)
      }
    }
    fetchUser()
  }, [router])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setOcrLoading(true)
    setOcrMessage('🤖 AI 正在精準辨識收據與外幣匯率...')

    try {
      const compressedFile = await new Promise<File>((resolve) => {
        const reader = new FileReader()
        reader.readAsDataURL(selectedFile)
        reader.onload = (event) => {
          const img = new window.Image()
          img.src = event.target?.result as string
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const MAX_WIDTH = 1200
            const MAX_HEIGHT = 1200
            let width = img.width
            let height = img.height

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width
                width = MAX_WIDTH
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height
                height = MAX_HEIGHT
              }
            }

            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx?.drawImage(img, 0, 0, width, height)

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const newFile = new File([blob], selectedFile.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  })
                  resolve(newFile)
                } else {
                  resolve(selectedFile)
                }
              },
              'image/jpeg',
              0.8
            )
          }
        }
      })

      setFile(compressedFile)

      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(compressedFile)
        reader.onload = () => {
          const result = reader.result as string
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = (error) => reject(error)
      })

      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          base64Image, 
          mimeType: 'image/jpeg' 
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.merchant) setMerchant(data.merchant)
      if (data.amount) setAmount(data.amount.toString())
      if (data.date) setDate(data.date)

      // 💡 接收外幣資訊並自動組合至備註欄位
      if (data.currency && data.currency.toUpperCase() !== 'HKD' && data.original_amount) {
        const foreignInfo = `原始外幣：${data.currency.toUpperCase()} ${data.original_amount} (參考匯率: ${data.exchange_rate || 'N/A'})`
        setNotes(prev => prev ? `${prev} | ${foreignInfo}` : foreignInfo)
        setOcrMessage(`✨ 辨識成功！已自動將 ${data.currency} 換算為港幣`)
      } else {
        setOcrMessage('✨ AI 辨識成功！欄位已自動填入')
      }

    } catch (err: any) {
      console.error(err)
      setOcrMessage('⚠️ AI 辨識發生錯誤，請手動填寫')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      let receiptUrl = ''

      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}_${Math.random()}.${fileExt}`
        const { error: uploadError } = await supabase
          .storage
          .from('receipts')
          .upload(fileName, file)

        if (uploadError) {
          alert('收據上傳失敗: ' + uploadError.message)
          return
        }

        const { data: publicUrlData } = supabase
          .storage
          .from('receipts')
          .getPublicUrl(fileName)
        
        receiptUrl = publicUrlData.publicUrl
      }

      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        date,
        category,
        merchant,
        amount: parseFloat(amount) || 0,
        notes,
        receipt_url: receiptUrl,
        status: 'pending',
        is_manually_edited: hasEdited
      })

      if (error) {
        alert('新增失敗: ' + error.message)
      } else {
        router.push('/expenses')
      }
    } catch (err: any) {
      console.error('提交發生例外錯誤:', err)
      alert('發生未預期錯誤: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8 bg-white rounded-3xl shadow-xl shadow-gray-100 mt-10 border border-gray-100">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">新增報銷申請</h1>
          <p className="text-xs text-gray-500 mt-1">上傳收據照片將透過 AI 自動填寫欄位（支援多國外幣自動換算）</p>
        </div>
        
        {currentUserProfile && (
          <div className="bg-blue-50/70 border border-blue-100 px-4 py-2.5 rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {currentUserProfile.full_name?.[0] || 'U'}
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900">{currentUserProfile.full_name || currentUserProfile.email}</div>
              <div className="text-[11px] text-blue-600 font-medium">
                {currentUserProfile.department || '未分配部門'} 
                {currentUserProfile.role === 'accounting_admin' && ' · 會計主管'}
                {currentUserProfile.role === 'department_head' && ' · 部門主管'}
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="bg-gray-50/60 p-5 rounded-2xl border border-dashed border-gray-300 hover:border-blue-500 transition-all">
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            📸 上傳收據照片 <span className="text-xs font-normal text-blue-600">(支援 AI 智慧識別外幣與折算)</span>
          </label>
          <input 
            type="file" 
            accept="image/*"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer transition-all"
          />
          {ocrLoading && (
            <div className="flex items-center gap-2 mt-3 text-xs text-blue-600 animate-pulse font-medium">
              <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>{ocrMessage}</span>
            </div>
          )}
          {!ocrLoading && ocrMessage && (
            <p className="text-xs text-emerald-600 mt-3 font-semibold flex items-center gap-1">
              {ocrMessage}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">收據日期</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => {
                setDate(e.target.value)
                if (!ocrLoading) setHasEdited(true)
              }}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">類別</label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            >
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
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">商戶名稱</label>
          <input 
            type="text" 
            value={merchant} 
            onChange={e => {
              setMerchant(e.target.value)
              if (!ocrLoading) setHasEdited(true)
            }}
            placeholder="例如：香港九龍巴士 / 7-Eleven"
            className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            required 
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">金額 (折算後 HKD)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-3 text-sm text-gray-400 font-semibold">$</span>
            <input 
              type="number" 
              step="0.01" 
              value={amount} 
              onChange={e => {
                setAmount(e.target.value)
                if (!ocrLoading) setHasEdited(true)
              }}
              placeholder="0.00"
              className="w-full rounded-xl border border-gray-300 pl-8 p-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              required 
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
            申請備註 / 原因（外幣細節將自動填入此處）
          </label>
          <textarea
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            placeholder="請輸入此筆報銷的用途或說明..." 
            rows={3}
            className="w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all focus:outline-none"
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            type="submit" 
            disabled={uploading || ocrLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-3.5 rounded-xl font-medium text-sm shadow-sm hover:shadow transition-all disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>提交中...</span>
              </>
            ) : (
              <span>提交報銷單據</span>
            )}
          </button>
          <button 
            type="button" 
            onClick={() => router.push('/expenses')}
            className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-6 py-3.5 rounded-xl text-sm font-medium border border-gray-200 transition-all"
          >
            返回列表
          </button>
        </div>
      </form>
    </main>
  )
}