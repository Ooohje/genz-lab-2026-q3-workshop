/**
 * README §5 — 하단 CTA. 높이 60, radius 30, 라벨 19/700.
 * 항상 화면 최하단에 고정한다(한 손 조작).
 */
export default function Cta({ children, variant = 'brand', className = '', ...props }) {
  const styles = {
    brand: 'bg-brand text-white',
    lime: 'bg-brand-lime text-brand-deep',
    ink: 'bg-ink text-white',
    success: 'bg-success text-white',
    ghost: 'border-2 border-line bg-white text-muted',
  }
  return (
    <button
      className={`h-[60px] w-full rounded-cta text-[19px] font-bold disabled:bg-line disabled:text-[#A09EAB] disabled:border-transparent ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
