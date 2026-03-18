/**
 * NSS i18n — Автозагрузка языков
 * 
 * ДОБАВИТЬ НОВЫЙ ЯЗЫК:
 * 1. Скопируй en.json → {код}.json (например: de.json, es.json, fr.json)
 * 2. Переведи все строки
 * 3. Добавь импорт ниже
 * 4. Добавь в languages массив
 * 
 * ВСЁ. Язык появится в переключателе автоматически.
 */

import en from './en.json'
import ru from './ru.json'
import uk from './uk.json'

// Все переводы
export const translations = {
  en,
  ru,
  uk,
  // Добавь новые языки здесь:
  // de,
  // es,
  // fr,
  // it,
  // pl,
  // tr,
  // ar,
  // zh,
  // ja,
  // ko,
  // vi,
  // th,
  // id,
  // pt,
  // nl,
  // cs,
  // ro,
  // hu,
  // el,
  // he,
  // hi,
  // bn,
  // fa,
  // sw,
  // ms,
}

// Список языков для переключателя
export const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Русский', flag: 'RU' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  // Добавь новые языки здесь:
  // { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  // { code: 'es', name: 'Español', flag: '🇪🇸' },
  // { code: 'fr', name: 'Français', flag: '🇫🇷' },
  // { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  // { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  // { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  // { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  // { code: 'zh', name: '中文', flag: '🇨🇳' },
  // { code: 'ja', name: '日本語', flag: '🇯🇵' },
  // { code: 'ko', name: '한국어', flag: '🇰🇷' },
  // { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  // { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  // { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
  // { code: 'pt', name: 'Português', flag: '🇧🇷' },
  // { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  // { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
  // { code: 'ro', name: 'Română', flag: '🇷🇴' },
  // { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  // { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  // { code: 'he', name: 'עברית', flag: '🇮🇱' },
  // { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  // { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
  // { code: 'fa', name: 'فارسی', flag: '🇮🇷' },
  // { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
  // { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
]

export default translations
