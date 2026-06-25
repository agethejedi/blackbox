interface Props { title: string; icon: string; description: string }
export default function PlaceholderPage({ title, icon, description }: Props) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-white mb-1">{title}</h1>
      <div className="mt-12 rounded-xl p-12 text-center" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-sm font-medium text-white mb-2">{title}</h3>
        <p className="text-xs max-w-sm mx-auto leading-relaxed" style={{ color: '#6b7280' }}>{description}</p>
      </div>
    </div>
  )
}
