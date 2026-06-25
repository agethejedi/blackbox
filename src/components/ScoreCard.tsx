interface Props {
  label: string
  score: number
  max?: number
  color?: string
  trend?: 'rising' | 'falling' | 'stable'
  size?: 'sm' | 'md' | 'lg'
}

export default function ScoreCard({ label, score, max = 100, color = '#8b5cf6', trend, size = 'md' }: Props) {
  const pct = Math.round((score / max) * 100)
  const trendIcon = trend === 'rising' ? '↑' : trend === 'falling' ? '↓' : '→'
  const trendColor = trend === 'rising' ? '#f87171' : trend === 'falling' ? '#34d399' : '#94a3b8'

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.15em] uppercase" style={{ color: '#6b7280' }}>{label}</span>
        {trend && <span className="text-[11px] font-bold" style={{ color: trendColor }}>{trendIcon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className={`font-light tabular-nums ${size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-3xl'}`}
          style={{ color }}>
          {score}
        </span>
        <span className="text-sm mb-1" style={{ color: '#374151' }}>/ {max}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1a2e' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
