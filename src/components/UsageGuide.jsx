const guideItems = [
  {
    title: '適正レベル',
    body: '「ちょうどいい」がたくさん表示されるくらいに音量を調整してください。',
  },
  {
    title: 'PEAK',
    body: 'つきっぱなしにならないくらいに調整してください。たまにつくくらいならOKです。',
  },
  {
    title: 'STEREO',
    body: 'ステレオかどうか判別します。ステレオ:左右が違う音です。ステレオ信号の可能性が高いです。 モノラル:左右が同じ音です。モノラル信号の可能性が高いです。 逆位相:左右同じ信号で極性が反転しています。ケーブルが不良品の可能性があります。(時々ならば問題ありません) / 片チャンネル:信号が片方のみです。2ch分岐されていないモノラルマイクか、ケーブルの接触不良の可能性があります。',
  },
]

export default function UsageGuide() {
  return (
    <div className="panel usage-guide">
      {guideItems.map((item) => (
        <div className="guide-item" key={item.title}>
          <div className="guide-title">{item.title}</div>
          <div className="guide-body">{item.body}</div>
        </div>
      ))}
    </div>
  )
}
