import { useLayerVisibility } from '../hooks/useLayerVisibility'
import { BASE_LAYER_DEFS } from '../config/layers'

const styles: Record<string, React.CSSProperties> = {
  section: { marginBottom: 24 },
  heading: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b',
    textTransform: 'uppercase', margin: '0 0 10px' },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0',
    borderBottom: '1px solid #2d3148', cursor: 'pointer', userSelect: 'none' },
  label: { fontSize: 13, color: '#cbd5e1', flex: 1 },
  checkbox: { accentColor: '#38bdf8', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 },
}

export default function LayerPanel() {
  const { visibility, toggle } = useLayerVisibility(BASE_LAYER_DEFS)

  return (
    <section style={styles.section}>
      <p style={styles.heading}>Base Layers</p>
      {BASE_LAYER_DEFS.map(def => (
        <label key={def.id} style={styles.row}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={visibility[def.id] ?? false}
            onChange={() => toggle(def.id)}
          />
          <span style={styles.label}>{def.label}</span>
        </label>
      ))}
    </section>
  )
}
