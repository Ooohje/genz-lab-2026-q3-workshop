/** 하단 안전영역까지 포함한 CTA 영역. iOS 홈 인디케이터에 가리지 않게 한다. */
export default function BottomBar({ children }) {
  return (
    <div
      className="flex flex-none flex-col gap-[12px] px-[20px]"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}
    >
      {children}
    </div>
  )
}
