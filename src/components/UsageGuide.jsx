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
    body: 'ステレオかどうか判別します。音が小さい場合は間違った判定になる場合があります。',
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
