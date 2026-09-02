/** 관리자가 송출하는 전체 공지. 어느 화면 위에도 뜬다. */
export default function NoticeBanner({ notice }) {
  if (!notice) return null
  return (
    <div className="flex-none bg-warn px-[20px] py-[10px] text-center text-[13px] font-bold text-[#3D2600]">
      {notice}
    </div>
  )
}
