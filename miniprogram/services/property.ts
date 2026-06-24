// 房源服务
import { request } from '../utils/request';

export interface PropertyListParams {
  city_id?: number;
  district?: string;
  price_min?: number;
  price_max?: number;
  keyword?: string;
  property_type?: string;
  auction_status?: string;
  auction_round?: string;
  // 入口附带的固定过滤（捡漏/昨日上架/昨日成交）
  discount_min?: number;
  discount_max?: number;
  listed_day?: string;
  sold_day?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  page_size?: number;
}

export async function getProperties(params: PropertyListParams): Promise<PaginatedResponse<PropertyItem>> {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v as any)}`)
    .join('&');
  return request<PaginatedResponse<PropertyItem>>({ url: `/properties?${qs}` });
}

export async function getPropertyDetail(id: number): Promise<PropertyDetail> {
  return request<PropertyDetail>({ url: `/properties/${id}` });
}

export async function getRecommendedProperties(cityId?: number, pageSize: number = 6): Promise<PropertyItem[]> {
  let url = `/properties/recommend?page_size=${pageSize}`;
  if (cityId) url += `&city_id=${cityId}`;
  return request<PropertyItem[]>({ url });
}

export async function getMarketStats(cityId?: number): Promise<MarketStats> {
  let url = '/market-stats';
  if (cityId) url += `?city_id=${cityId}`;
  return request<MarketStats>({ url });
}

export interface HomeSummary {
  on_auction: number;
  bargain: number;
  avg_discount: number;
}

export async function getHomeSummary(): Promise<HomeSummary> {
  return request<HomeSummary>({ url: '/home-summary' });
}

export async function getBanners(cityId?: number): Promise<BannerItem[]> {
  let url = '/banners';
  if (cityId) url += `?city_id=${cityId}`;
  return request<BannerItem[]>({ url });
}

export async function getCities(): Promise<CityItem[]> {
  return request<CityItem[]>({ url: '/cities' });
}

export interface MapFilterParams {
  city_id?: number;
  district?: string;
  sub_district?: string;
  property_type?: string;
  price_min?: number;
  price_max?: number;
  area_min?: number;
  area_max?: number;
  keyword?: string;
}

function buildQs(params: Record<string, any>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v as any)}`)
    .join('&');
}

export async function getMapMarkers(params: MapFilterParams): Promise<any[]> {
  return request<any[]>({ url: `/properties/map-markers?${buildQs(params)}` });
}

export interface MapAggItem {
  name: string;
  count: number;
  center_lat: number | null;
  center_lng: number | null;
}

export async function getMapAggregate(
  level: 'district' | 'sub_district',
  params: MapFilterParams
): Promise<MapAggItem[]> {
  return request<MapAggItem[]>({ url: `/properties/map-aggregate?level=${level}&${buildQs(params)}` });
}

export async function getDistrictAnalysis(propertyId: number): Promise<DistrictAnalysis> {
  return request<DistrictAnalysis>({ url: `/properties/${propertyId}/analysis` });
}

export async function getPropertyAmenities(propertyId: number): Promise<PropertyAmenities> {
  return request<PropertyAmenities>({ url: `/properties/${propertyId}/amenities` });
}
