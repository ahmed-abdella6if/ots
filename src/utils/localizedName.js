// Resolves a bilingual display name for a product/category-shaped entity.
// Most records don't have name_ar/name_en populated in the database yet
// (only the legacy `name` column does), so `name` is what actually renders
// today — nameAr/nameEn take priority only once a caller's service mapping
// starts populating them.
export function getLocalizedName(entity, language) {
  if (!entity) return ''
  if (language === 'en') return entity.nameEn || entity.name || entity.nameAr || ''
  return entity.nameAr || entity.name || entity.nameEn || ''
}
