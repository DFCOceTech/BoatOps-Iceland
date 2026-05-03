import type { BlobResult } from '../api/client'

interface Props {
  colorscale: BlobResult['colorscale']
  gradient: string
  unit: string
}

export default function ColorscaleLegend({ colorscale, gradient, unit }: Props) {
  const isLog = colorscale.scale === 'log'
  const fmt = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1)

  return (
    <div style={{ margin: '6px 0 2px' }}>
      <div style={{
        height: 6,
        borderRadius: 3,
        background: gradient,
        marginBottom: 3,
      }} />
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 10,
        color: '#64748b',
      }}>
        <span style={{ color: '#94a3b8' }}>{fmt(colorscale.vmin)} {unit}</span>
        <span>{colorscale.cmap.replace('cmocean.', '')}{isLog ? ' · log' : ''}</span>
        <span style={{ color: '#94a3b8' }}>{fmt(colorscale.vmax)} {unit}</span>
      </div>
    </div>
  )
}
