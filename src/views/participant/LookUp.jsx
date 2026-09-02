import TopBar from '../../components/TopBar'

/** 중간 리더보드 구간. 순위는 스크린에 띄우고 폰은 시선을 앞으로 보낸다. */
export default function LookUp({ participant, teamName }) {
  return (
    <div className="flex h-full flex-col bg-brand">
      <TopBar participant={participant} teamName={teamName} dark />
      <div className="flex flex-1 flex-col items-center justify-center gap-[16px] px-[24px] text-center">
        <span className="animate-bob text-[56px]">👀</span>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-white">앞을 봐주세요</h1>
        <p className="max-w-[260px] text-[14px] leading-[1.6] text-[#D5C6FF]">
          중간 순위를 화면에 공개하고 있습니다.
        </p>
      </div>
    </div>
  )
}
