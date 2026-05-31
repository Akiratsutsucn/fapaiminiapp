// 全局类型定义

interface IAppOption {
  globalData: {
    token: string;
    refreshToken: string;
    userInfo: UserInfo | null;
    currentCityId: number;
    currentCityName: string;
    systemInfo?: WechatMiniprogram.SystemInfo;
  };
  setToken(accessToken: string, refreshToken: string): void;
  clearToken(): void;
  isLoggedIn(): boolean;
}

interface UserInfo {
  id: number;
  nickname: string;
  avatar_url: string | null;
  phone: string | null;
  gender: number | null;
  role: string;
}

interface PropertyItem {
  id: number;
  title: string;
  district: string;
  community_name: string;
  area: number;
  layout: string | null;
  starting_price: number;
  starting_unit_price: number;
  appraisal_price: number;
  court_discount_rate: number;
  auction_round: string;
  auction_status: string;
  auction_start_time: string | null;
  auction_end_time: string | null;
  cover_image: string | null;
  property_type: string;
}

interface PropertyDetail {
  id: number;
  source_url: string;
  auction_platform: string;
  city_id: number;
  title: string;
  province_city: string;
  district: string;
  sub_district: string | null;
  ring_road: string | null;
  address: string;
  community_name: string;
  lat: number | null;
  lng: number | null;
  property_type: string;
  area: number;
  layout: string | null;
  floor_info: string | null;
  total_floors: number | null;
  has_elevator: boolean | null;
  orientation: string | null;
  decoration: string | null;
  build_year: number | null;
  starting_price: number;
  starting_unit_price: number;
  appraisal_price: number;
  court_discount_rate: number;
  deposit: number;
  increment_amount: number;
  market_deal_price: number;
  market_deal_unit_price: number;
  market_discount_rate: number;
  listing_min_price: number;
  latest_deal_unit_price: number;
  latest_total_price: number;
  bargain_potential: number;
  auction_round: string;
  auction_status: string;
  auction_start_time: string | null;
  auction_end_time: string | null;
  court_name: string | null;
  case_number: string | null;
  announcement_url: string | null;
  description: string | null;
  view_count: number;
  participant_count: number;
  loan_support: boolean | null;
  has_attachments: boolean | null;
  images: PropertyImage[];
  created_at: string | null;
  updated_at: string | null;
  beike_latest_deal_unit_price: number;
  beike_latest_deal_total_price: number;
  beike_latest_deal_time: string | null;
  community_info: CommunityInfoData | null;
  deal_reference: DealReference | null;
}

interface DealReference {
  unit_price: number;
  total_price: number | null;
  source_label: string;
  updated_at: string | null;
}

interface CommunityInfoData {
  id: number;
  name: string;
  district: string;
  address_full: string | null;
  avg_price: number | null;
  price_update_at: string | null;
  build_year_start: number | null;
  build_year_end: number | null;
  property_type: string | null;
  total_buildings: number | null;
  total_units: number | null;
  developer: string | null;
  plot_ratio: number | null;
  green_rate: number | null;
  property_company: string | null;
  property_fee: string | null;
  huxing_summary: string | null;
  recent_deal_count_30d: number | null;
  recent_avg_price_30d: number | null;
  on_sale_count: number | null;
  rent_count: number | null;
  description: string | null;
  beike_url: string | null;
  last_crawled_at: string | null;
  source: string | null;
}

interface PropertyImage {
  id: number;
  image_url: string;
  thumb_url: string | null;
  sort_order: number;
  is_cover: boolean;
}

interface ArticleItem {
  id: number;
  title: string;
  summary: string | null;
  cover_image: string | null;
  mp_url: string | null;
  published_at: string | null;
  created_at: string | null;
}

interface BannerItem {
  id: number;
  title: string;
  image_url: string;
  category: string | null;
  link_url: string | null;
  sort_order: number;
}

interface MarketStats {
  bargain_count: number;
  upcoming_count: number;
  yesterday_listed: number;
  yesterday_sold: number;
}

interface CityItem {
  city_id: number;
  city_name: string;
  is_active: boolean;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface DemandForm {
  name: string;
  gender?: number;
  phone: string;
  city?: string;
  purpose?: string;
  budget?: string;
  own_funds?: string;
  target_district?: string;
  remark?: string;
  source?: 'demand-form' | 'message';
}

interface DistrictAnalysis {
  district: string;
  city_id: number;
  total_active: number;
  avg_starting_price: number;
  avg_starting_price_wan: number;
  avg_discount_rate: number;
  avg_area: number;
  min_starting_price: number;
  max_starting_price: number;
  status_distribution: Record<string, number>;
  type_distribution: Record<string, number>;
}

interface AmenityItem {
  name: string;
  address: string;
  distance: number;
  type: string;
}

interface PropertyAmenities {
  amenities: Record<string, AmenityItem[]>;
  lat?: number;
  lng?: number;
  message?: string;
}
