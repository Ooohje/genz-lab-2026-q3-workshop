import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    '.env 에 VITE_SUPABASE_URL 과 VITE_SUPABASE_PUBLISHABLE_KEY 가 필요합니다. ' +
    '값을 바꾼 뒤에는 dev 서버를 재시작해야 반영됩니다.',
  )
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },   // Supabase Auth 를 쓰지 않는다. 로그인은 Knox ID 단일 입력.
  realtime: { params: { eventsPerSecond: 10 } },
})

// 개발 중 콘솔에서 상태를 들여다보기 위한 창구. 프로덕션 번들에는 포함되지 않는다.
if (import.meta.env.DEV) {
  window.__sb = supabase
}
