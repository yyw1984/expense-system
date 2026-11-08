import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { base64Image, mimeType } = body

    if (!base64Image) {
      return NextResponse.json({ error: '找不到圖片資料' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: '伺服器未設定 Gemini API 金鑰' }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    // 加入自動重試機制，應對偶發的 503 高流量過載
    let response: any = null
    let retries = 3
    let lastError: any = null

    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType || 'image/jpeg'
              }
            },
            {
              text: '請分析這張收據圖片，並嚴格以純 JSON 格式回傳以下三個欄位：merchant (商戶名稱, string)、amount (總金額, 數字浮點數)、date (日期, 格式為 YYYY-MM-DD)。如果找不到請填 null。不要包含任何 Markdown 代碼塊或額外文字。'
            }
          ]
        })
        break // 成功取得回應就跳出重試迴圈
      } catch (err: any) {
        lastError = err
        retries--
        if (retries > 0) {
          // 等待 1 秒後再次嘗試
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Gemini API 請求失敗')
    }

    let textResponse = response.text || '{}'
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
    
    const result = JSON.parse(textResponse)
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('API Route 內部發生嚴重錯誤:', error)
    return NextResponse.json({ error: error.message || '伺服器發生未知錯誤' }, { status: 500 })
  }
}