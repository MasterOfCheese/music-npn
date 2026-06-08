/**
 * Tạo slug từ chuỗi text (bỏ dấu tiếng Việt, viết thường, thay space bằng -)
 * @param text Chuỗi cần tạo slug
 * @returns Slug đã xử lý
 */
export function slugify(text: string): string {
  if (!text) return '';
  
  // Chuyển sang chữ thường
  let slug = text.toLowerCase();
  
  // Bỏ dấu tiếng Việt
  const vietnameseMap: { [key: string]: string } = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    'đ': 'd'
  };
  
  slug = slug.replace(/[àáảãạăằắẳẵặâầấẩẫậ]/g, (m) => vietnameseMap[m]);
  slug = slug.replace(/[èéẻẽẹêềếểễệ]/g, (m) => vietnameseMap[m]);
  slug = slug.replace(/[ìíỉĩị]/g, (m) => vietnameseMap[m]);
  slug = slug.replace(/[òóỏõọôồốổỗộơờớởỡợ]/g, (m) => vietnameseMap[m]);
  slug = slug.replace(/[ùúủũụưừứửữự]/g, (m) => vietnameseMap[m]);
  slug = slug.replace(/[ỳýỷỹỵ]/g, (m) => vietnameseMap[m]);
  slug = slug.replace(/đ/g, vietnameseMap['đ']);
  
  // Chỉ giữ lại chữ cái, số, dấu cách và dấu gạch ngang
  slug = slug.replace(/[^a-z0-9\s-]/g, '');
  
  // Thay khoảng trắng và dấu gạch ngang liên tiếp bằng một dấu gạch ngang
  slug = slug.replace(/[\s-]+/g, '-');
  
  // Xóa dấu gạch ngang ở đầu và cuối
  slug = slug.replace(/^-+|-+$/g, '');
  
  // Giới hạn độ dài slug (ví dụ: 100 ký tự)
  slug = slug.slice(0, 100);
  
  return slug;
}

/**
 * Tạo slug unique (thêm số thứ tự nếu cần)
 * @param baseSlug Slug cơ bản
 * @param existingSlugs Danh sách các slug đã tồn tại
 * @returns Slug unique
 */
export function getUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }
  
  let counter = 1;
  let newSlug = `${baseSlug}-${counter}`;
  while (existingSlugs.includes(newSlug)) {
    counter++;
    newSlug = `${baseSlug}-${counter}`;
  }
  return newSlug;
}