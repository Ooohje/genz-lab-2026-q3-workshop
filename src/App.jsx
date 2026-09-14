import { useEffect, useState } from 'react'
import ParticipantApp from './views/participant/ParticipantApp'
import ScreenView from './views/screen/ScreenView'
import AdminView from './views/admin/AdminView'
import DinnerView from './views/dinner/DinnerView'
import PollView from './views/poll/PollView'
import Goodbye from './views/common/Goodbye'

/**
 * 해시 라우터.
 * GitHub Pages 는 하위 경로에서 새로고침하면 404 가 나므로 해시를 쓴다.
 * 라우팅 라이브러리를 넣을 만큼 경로가 많지 않다 (3개).
 */
function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export default function App() {
  const route = useHashRoute()
  if (route.startsWith('/screen')) return <ScreenView />
  if (route.startsWith('/admin')) return <AdminView />
  if (route.startsWith('/dinner')) return <DinnerView />
  if (route.startsWith('/poll/')) return <PollView slug={route.slice('/poll/'.length).split('?')[0]} />
  if (route.startsWith('/bye')) return <Goodbye />
  return <ParticipantApp />
}
