import { ProfileColorPresets } from '@shared/schemas/profile.constraints'
import { useI18n } from '../../../shared/i18n/I18nProvider'
import { cx } from '../../../shared/utils/text'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { t } = useI18n()
  return (
    <div className="colors" role="radiogroup" aria-label={t('form.color')}>
      {ProfileColorPresets.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          className={cx('swatch', value === color && 'is-selected')}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <input
        type="color"
        aria-label={t('form.customColor')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
