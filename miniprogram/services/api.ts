// API 服务层 — 统一导出
export { login } from './auth';
export {
  getProperties,
  getPropertyDetail,
  getRecommendedProperties,
  getMarketStats,
  getCities,
  getBanners,
} from './property';
export { getArticles, getRecommendedArticles, getArticleDetail } from './article';
export {
  getUserProfile,
  updateUserProfile,
  getUserStats,
  getFavorites,
  addFavorite,
  removeFavorite,
  getBrowseHistory,
} from './user';
export { submitDemand } from './demand';
