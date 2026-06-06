"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const property_1 = require("../../services/property");
const user_1 = require("../../services/user");
const settings_1 = require("../../services/settings");
const storage_1 = require("../../utils/storage");
const format_1 = require("../../utils/format");
const app = getApp();
Page({
    data: {
        property: {},
        images: [],
        activeTab: 'basic',
        isFavorited: false,
        favoriteId: 0,
        statusLabel: '',
        statusTagClass: '',
        startingPriceWan: '',
        appraisalPriceWan: '',
        depositWan: '',
        discount: '',
        discountLabel: '折扣',
        countdown: '',
        auctionTimeFull: '',
        showAnalysis: false,
        analysis: null,
        amenities: null,
        amenityLabels: {
            school: '学校', hospital: '医院', transit: '交通',
            shopping: '购物', food: '餐饮', bank: '银行',
        },
        analysisUrl: '',
        safeAuctionUrl: '',
        regionInfo: '',
        incrementAmountText: '',
        biddingTime: '',
        noticeExpanded: false,
        commentary: null,
        blockIntro: '',
        mapMarkers: [],
        communityAvgPriceWan: '',
        communityAvgUnitPriceWan: '',
        communityGreenRatePct: '',
        startingUnitPriceWan: '',
        communityDiscountText: '',
        dealRefUnitPriceWan: '',
        dealRefSourceLabel: '',
        dealRefDiscountText: '',
        dealRefBargainDelta: '',
        communityFallback: '',
    },
    onLoad(options) {
        const id = parseInt(options.id);
        if (id) {
            this.loadProperty(id);
            this.loadSettings();
            (0, storage_1.addBrowseHistory)('property', id);
        }
    },
    async loadSettings() {
        try {
            const settings = await (0, settings_1.getSettings)();
            this.setData({
                analysisUrl: settings.analysis_url || '',
                safeAuctionUrl: settings.safe_url || '',
            });
        }
        catch (_) {
        }
    },
    async loadProperty(id) {
        try {
            const property = await (0, property_1.getPropertyDetail)(id);
            const beikePriceWan = property.beike_latest_deal_unit_price
                ? (0, format_1.formatPriceWan)(property.beike_latest_deal_unit_price * (property.area || 100)) : '';
            const beikeUnitPrice = property.beike_latest_deal_unit_price
                ? property.beike_latest_deal_unit_price.toLocaleString() : '';
            const bargainDelta = property.bargain_potential > 0
                ? (property.bargain_potential / 10000).toFixed(0) : '';
            const regionParts = [property.district, property.sub_district, property.ring_road].filter(Boolean);
            const regionInfo = regionParts.join(' - ');
            let incrementAmountText = '--';
            if (property.increment_amount && property.increment_amount > 0) {
                if (property.increment_amount >= 10000) {
                    incrementAmountText = (property.increment_amount / 10000).toFixed(property.increment_amount % 10000 === 0 ? 0 : 1) + '万元及其倍数';
                }
                else {
                    incrementAmountText = property.increment_amount.toLocaleString() + '元及其倍数';
                }
            }
            let biddingTime = '';
            if (property.auction_start_time) {
                const start = (0, format_1.formatDate)(property.auction_start_time, 'YYYY-MM-DD HH:mm');
                if (property.auction_end_time) {
                    const end = (0, format_1.formatDate)(property.auction_end_time, 'MM-DD HH:mm');
                    biddingTime = `${start} 至 ${end}`;
                }
                else {
                    biddingTime = `${start} 起`;
                }
            }
            const commentary = this.buildCommentary(property);
            const blockIntro = this.buildBlockIntro(property);
            const communityFallback = this.buildCommunityFallback(property);
            const mapMarkers = (property.lat && property.lng) ? [{
                    id: 1,
                    latitude: property.lat,
                    longitude: property.lng,
                    width: 32,
                    height: 32,
                    callout: {
                        content: property.community_name || property.title || '房源位置',
                        color: '#fff',
                        fontSize: 12,
                        borderRadius: 4,
                        bgColor: '#2563EB',
                        padding: 6,
                        display: 'ALWAYS',
                    },
                }] : [];
            let communityAvgPriceWan = '';
            let communityAvgUnitPriceWan = '';
            let communityGreenRatePct = '';
            let startingUnitPriceWan = '';
            let communityDiscountText = '';
            const ci = property.community_info;
            if (ci) {
                if (ci.avg_price) {
                    communityAvgPriceWan = ci.avg_price.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
                    communityAvgUnitPriceWan = (ci.avg_price / 10000).toFixed(2);
                }
                if (ci.green_rate) {
                    communityGreenRatePct = (ci.green_rate * 100).toFixed(0) + '%';
                }
                if (property.starting_unit_price) {
                    startingUnitPriceWan = (property.starting_unit_price / 10000).toFixed(2);
                }
                if (ci.avg_price && property.starting_unit_price) {
                    const ratio = property.starting_unit_price / ci.avg_price;
                    const off = (1 - ratio) * 10;
                    if (off > 0) {
                        communityDiscountText = off.toFixed(1) + ' 折';
                    }
                    else {
                        communityDiscountText = '高于市场价';
                    }
                }
            }
            let dealRefUnitPriceWan = '';
            let dealRefSourceLabel = '';
            let dealRefDiscountText = '';
            let dealRefBargainDelta = '';
            const dr = property.deal_reference;
            if (dr && dr.unit_price > 0) {
                dealRefUnitPriceWan = (dr.unit_price / 10000).toFixed(2);
                dealRefSourceLabel = dr.source_label || '市场参考';
                if (property.starting_unit_price) {
                    const off = (1 - property.starting_unit_price / dr.unit_price) * 10;
                    dealRefDiscountText = off > 0 ? off.toFixed(1) + ' 折' : '高于市场价';
                    if (off > 0 && property.area) {
                        const delta = (dr.unit_price - property.starting_unit_price) * property.area / 10000;
                        if (delta > 0)
                            dealRefBargainDelta = delta.toFixed(1);
                    }
                }
            }
            const images = (property.images || []).filter((img) => img && img.image_url);
            this.setData({
                property,
                images,
                statusLabel: (0, format_1.statusLabel)(property.auction_status),
                statusTagClass: (0, format_1.statusTagClass)(property.auction_status),
                startingPriceWan: (0, format_1.formatPriceWan)(property.starting_price),
                appraisalPriceWan: (0, format_1.formatPriceWan)(property.appraisal_price),
                depositWan: (0, format_1.formatPriceWan)(property.deposit),
                discount: (property.court_discount_rate && property.court_discount_rate < 1) ? (0, format_1.formatDiscount)(property.court_discount_rate) : (property.court_discount_rate >= 1 ? '超人气' : '--'),
                discountLabel: (property.court_discount_rate && property.court_discount_rate >= 1) ? '人气' : '折扣',
                countdown: (0, format_1.formatCountdown)(property.auction_start_time),
                auctionTimeFull: property.auction_start_time ? (0, format_1.formatDate)(property.auction_start_time, 'YYYY-MM-DD HH:mm') : '时间待定',
                beikePriceWan,
                beikeUnitPrice,
                bargainDelta,
                regionInfo,
                incrementAmountText,
                biddingTime,
                commentary,
                blockIntro,
                mapMarkers,
                communityAvgPriceWan,
                communityAvgUnitPriceWan,
                communityGreenRatePct,
                startingUnitPriceWan,
                communityDiscountText,
                dealRefUnitPriceWan,
                dealRefSourceLabel,
                dealRefDiscountText,
                dealRefBargainDelta,
                communityFallback,
            });
            this.checkFavoriteStatus(id);
        }
        catch (e) {
            console.error('加载房源详情失败:', e);
            wx.showToast({ title: '加载失败', icon: 'none' });
        }
    },
    buildCommentary(p) {
        const out = {};
        if (p.starting_price && p.appraisal_price && p.appraisal_price > 0) {
            const startWan = (p.starting_price / 10000).toFixed(1);
            const apprWan = (p.appraisal_price / 10000).toFixed(1);
            const ratio = p.starting_price / p.appraisal_price;
            const discountPct = ((1 - ratio) * 100).toFixed(0);
            const diff = ((p.appraisal_price - p.starting_price) / 10000).toFixed(1);
            let level = '';
            if (ratio < 0.65)
                level = '远低于评估价，捡漏空间显著';
            else if (ratio < 0.8)
                level = '低于评估价，价格优势明显';
            else if (ratio < 0.95)
                level = '接近评估价，仍有一定折扣';
            else
                level = '基本贴近评估价';
            out.priceInsight = `起拍总价 ${startWan} 万元，较评估价 ${apprWan} 万元低 ${diff} 万元（约 ${discountPct}%），${level}。`;
        }
        else if (p.starting_price) {
            const startWan = (p.starting_price / 10000).toFixed(1);
            out.priceInsight = `起拍总价 ${startWan} 万元。`;
        }
        if (p.starting_price && p.beike_latest_deal_unit_price && p.area) {
            const beikeTotal = p.beike_latest_deal_unit_price * p.area;
            if (beikeTotal > 0) {
                const beikeWan = (beikeTotal / 10000).toFixed(0);
                const startWan = (p.starting_price / 10000).toFixed(0);
                const diffWan = ((beikeTotal - p.starting_price) / 10000).toFixed(0);
                if (parseFloat(diffWan) > 0) {
                    out.bargainInsight = `起拍价 ${startWan} 万元，较同小区贝壳近成交单价 ${p.beike_latest_deal_unit_price.toLocaleString()} 元/㎡推算总价 ${beikeWan} 万元低 ${diffWan} 万元，价差显著，建议关注。`;
                }
                else {
                    out.bargainInsight = `起拍价 ${startWan} 万元已接近或高于贝壳近成交参考价，性价比一般，需谨慎评估。`;
                }
            }
        }
        if (p.district || p.sub_district) {
            const loc = p.sub_district || p.district;
            const isSH = p.city_id === 310000 || (p.province_city || '').indexOf('上海') >= 0;
            if (isSH && (p.ring_road === '内环内' || p.ring_road === '内环')) {
                out.locationInsight = `${loc} 位于上海内环内核心区域，区位优势明显，配套成熟，保值性较强。`;
            }
            else if (isSH && p.ring_road === '中环内') {
                out.locationInsight = `${loc} 位于上海中环以内，交通便利，生活配套较为完善。`;
            }
            else if (isSH && p.ring_road === '外环内') {
                out.locationInsight = `${loc} 位于上海外环以内，发展潜力较好，价格相对中环更具性价比。`;
            }
            else if (isSH && p.ring_road === '外环外') {
                out.locationInsight = `${loc} 位于上海外环以外，价格门槛较低，适合刚需或投资关注。`;
            }
        }
        if (!out.priceInsight && !out.bargainInsight && !out.locationInsight)
            return null;
        return out;
    },
    buildBlockIntro(p) {
        if (!p.sub_district)
            return '';
        const dict = {
            '西藏北路': '西藏北路板块在并入静安之前隶属于闸北区，地处苏州河北岸、南北高架以东，区位优势明显。轨交 1/8/12 号线交汇，紧临大悦城商圈、月星环球港，生活配套完善。',
            '陆家嘴': '陆家嘴板块为上海金融核心区，集中了上海最高端的写字楼与豪宅，地铁 2 号线贯穿全境，浦东机场、虹桥枢纽往返便捷。',
            '徐家汇': '徐家汇板块为上海传统市级商圈，地铁 1/9/11 号线交汇，港汇恒隆、太平洋百货、徐家汇商城等大型商业体林立。',
            '人民广场': '人民广场板块位于上海市中心，地铁 1/2/8 号线汇聚，周边市政公共配套齐全，文化场馆密集。',
            '中山公园': '中山公园板块位于长宁与普陀交界，地铁 2/3/4 号线交汇，龙之梦购物中心、来福士、玫瑰坊等商业辐射半径大。',
        };
        return dict[p.sub_district] || '';
    },
    buildCommunityFallback(p) {
        const DISTRICT_INTRO = {
            '黄浦区': '黄浦区为上海中心城区核心，外滩、人民广场、新天地坐落于此，地铁线网密集，商业与人文配套顶级，房产保值性强。',
            '徐汇区': '徐汇区为上海传统优质生活区，徐家汇商圈、滨江开发带动板块价值，教育医疗资源集中，二手房流通性好。',
            '静安区': '静安区位居市中心，南京西路商圈与大宁板块并重，轨交便利，租售两旺。',
            '长宁区': '长宁区中山公园、虹桥地区商务与居住兼备，临近虹桥枢纽，配套成熟。',
            '普陀区': '普陀区苏州河沿线开发活跃，长寿路、真如板块商业升级，性价比相对突出。',
            '虹口区': '虹口区北外滩开发提速，临近陆家嘴隔江相望，轨交便利，发展潜力较好。',
            '杨浦区': '杨浦区高校云集，五角场商圈成熟，滨江与创智天地带动产业与人口导入。',
            '浦东新区': '浦东新区为上海面积最大城区，陆家嘴金融城、张江科学城、前滩等板块价值梯度明显，配套差异较大，需结合具体板块判断。',
            '闵行区': '闵行区莘庄、七宝、前滩外溢承接区位优良，刚需与改善需求集中，轨交覆盖较广。',
            '宝山区': '宝山区大场、顾村板块刚需活跃，地铁 7/1/15 号线沿线配套逐步完善，价格门槛较低。',
            '嘉定区': '嘉定区汽车产业聚集，嘉定新城、南翔板块宜居，11 号线直达市区，性价比突出。',
            '松江区': '松江区大学城、松江新城与 G60 科创走廊带动发展，9 号线沿线居住成熟。',
            '青浦区': '青浦区为长三角一体化示范区核心，赵巷、徐泾承接虹桥外溢，西郊生态宜居。',
            '奉贤区': '奉贤区南桥新城为中心，临港南桥科技城带动产业，价格门槛低，适合刚需与投资关注。',
            '金山区': '金山区位于上海西南，石化与滨海旅游为特色，房价处于全市低位。',
            '崇明区': '崇明区为生态岛，开发强度低，自住属性为主。',
            '上城区': '上城区为杭州主城核心，武林、湖滨、钱江新城商圈林立，配套与教育资源优质。',
            '拱墅区': '拱墅区运河沿线人文浓厚，武林商圈北延，地铁便利，居住氛围成熟。',
            '西湖区': '西湖区坐拥西湖景区与文教区，学区与环境俱佳，房产保值性强。',
            '滨江区': '滨江区为杭州高新产业核心，互联网企业聚集，人口年轻，居住需求旺盛。',
            '萧山区': '萧山区临近萧山机场与亚运板块，城市化推进快，配套日趋完善。',
            '余杭区': '余杭区未来科技城带动产业与人口快速导入，新兴改善板块活跃。',
            '临平区': '临平区为杭州东北门户，地铁延伸带动居住，价格相对亲民。',
            '钱塘区': '钱塘区高教园区与产业新城并进，发展潜力较好，门槛较低。',
            '富阳区': '富阳区山水人文兼具，承接主城外溢，宜居属性突出。',
            '海曙区': '海曙区为宁波老城核心，天一商圈成熟，人文与商业配套齐全。',
            '江北区': '江北区老外滩与文教区并存，滨江居住环境优良。',
            '鄞州区': '鄞州区为宁波行政与商务中心，南部商务区与东部新城配套领先。',
            '镇海区': '镇海区临港产业为基础，居住板块稳步发展。',
            '北仑区': '北仑区港口经济发达，产业人口集中，刚需活跃。',
            '奉化区': '奉化区融入宁波主城步伐加快，价格门槛较低。',
        };
        const parts = [];
        const intro = (p.district && DISTRICT_INTRO[p.district]) || '';
        if (intro)
            parts.push(intro);
        const facts = [];
        if (p.property_type)
            facts.push(`物业类型为${p.property_type}`);
        if (p.area)
            facts.push(`建筑面积约 ${p.area}㎡`);
        if (p.build_year)
            facts.push(`建于 ${p.build_year} 年`);
        if (facts.length) {
            parts.push(`本标的位于${p.district || ''}${p.sub_district || ''}，${facts.join('，')}。`);
        }
        if (!intro && !facts.length) {
            if (p.community_name) {
                return `${p.community_name} 的详细小区数据正在补充中。可参考下方价差分析与法院公告了解标的情况，建议结合实地看房与尽调综合判断。`;
            }
            return '';
        }
        parts.push('小区级详细数据（均价/容积率/物业等）正在持续补充，建议结合实地看房与法院公告综合判断。');
        return parts.join('');
    },
    onToggleNotice() {
        this.setData({ noticeExpanded: !this.data.noticeExpanded });
    },
    onRiskTap(e) {
        const idx = e.currentTarget.dataset.index;
        const tag = this.data.property && this.data.property.risk_tags && this.data.property.risk_tags[idx];
        if (!tag)
            return;
        wx.showModal({
            title: tag.label,
            content: tag.detail || '该提示由公告信息自动提炼，建议结合原始公告核实。',
            confirmText: '我知道了',
            showCancel: false,
        });
    },
    async checkFavoriteStatus(propertyId) {
        if (!app.isLoggedIn())
            return;
        try {
            const res = await (0, user_1.getFavorites)('property', 1, 100);
            const fav = (res.items || []).find((f) => f.target_id === propertyId);
            if (fav) {
                this.setData({ isFavorited: true, favoriteId: fav.id });
            }
        }
        catch (_) {
        }
    },
    async onToggleFavorite() {
        if (!app.isLoggedIn()) {
            wx.navigateTo({ url: '/pages/login/login' });
            return;
        }
        const propertyId = this.data.property.id;
        const newState = !this.data.isFavorited;
        this.setData({ isFavorited: newState });
        try {
            if (newState) {
                const res = await (0, user_1.addFavorite)('property', propertyId);
                if (res && res.id)
                    this.setData({ favoriteId: res.id });
            }
            else {
                await (0, user_1.removeFavorite)(this.data.favoriteId);
                this.setData({ favoriteId: 0 });
            }
            wx.showToast({ title: newState ? '已收藏' : '已取消收藏', icon: 'none' });
        }
        catch (e) {
            this.setData({ isFavorited: !newState });
            wx.showToast({ title: '操作失败', icon: 'none' });
        }
    },
    onShare() {
    },
    onShareAppMessage() {
        var _a;
        const p = this.data.property;
        return {
            title: p.title || '法拍者联盟 房源信息',
            path: `/pages/property-detail/property-detail?id=${p.id}`,
            imageUrl: ((_a = this.data.images) === null || _a === void 0 ? void 0 : _a[0]) || '',
        };
    },
    onContact() {
        wx.navigateTo({ url: '/pages/customer-service/customer-service' });
    },
    async onAnalysis() {
        if (this.data.analysisUrl) {
            this.openExternalLink(this.data.analysisUrl);
            return;
        }
        if (this.data.analysis) {
            this.setData({ showAnalysis: true });
            return;
        }
        try {
            wx.showLoading({ title: '加载中...' });
            const analysis = await (0, property_1.getDistrictAnalysis)(this.data.property.id);
            const priceMinWan = (analysis.min_starting_price / 10000).toFixed(0);
            const priceMaxWan = (analysis.max_starting_price / 10000).toFixed(0);
            analysis.priceRangeText = priceMinWan + '万 - ' + priceMaxWan + '万';
            this.setData({ analysis, showAnalysis: true });
        }
        catch (e) {
            wx.showToast({ title: '加载板块数据失败', icon: 'none' });
        }
        finally {
            wx.hideLoading();
        }
    },
    onSafeAuction() {
        if (this.data.safeAuctionUrl) {
            this.openExternalLink(this.data.safeAuctionUrl);
        }
        else {
            wx.showToast({ title: '暂无内容', icon: 'none' });
        }
    },
    openExternalLink(url) {
        if (url.startsWith('http')) {
            wx.showModal({
                title: '查看公众号文章',
                content: '由于小程序无法直接打开外部链接，链接将复制到剪贴板，请在微信内粘贴打开。',
                confirmText: '复制链接',
                cancelText: '取消',
                success: (res) => {
                    if (res.confirm) {
                        wx.setClipboardData({
                            data: url,
                            success: () => wx.showToast({ title: '已复制', icon: 'success' }),
                        });
                    }
                },
            });
        }
        else {
            wx.navigateTo({ url, fail: () => {
                    wx.showToast({ title: '页面不存在', icon: 'none' });
                } });
        }
    },
    onCloseAnalysis() {
        this.setData({ showAnalysis: false });
    },
    onCalc() {
        const p = this.data.property || {};
        const price = p.starting_price || 0;
        const area = p.area || 0;
        wx.showActionSheet({
            itemList: ['房贷月供计算', '法拍税费 / 上岸成本'],
            success: (res) => {
                if (res.tapIndex === 0) {
                    const wan = price ? (price / 10000).toFixed(0) : '';
                    wx.navigateTo({ url: `/pages/mortgage-calculator/mortgage-calculator?total=${wan}` });
                } else if (res.tapIndex === 1) {
                    wx.navigateTo({ url: `/pages/tax-calculator/tax-calculator?price=${price}&area=${area}` });
                }
            },
        });
    },
    onTabSwitch(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({ activeTab: tab });
        if (tab === 'around' && !this.data.amenities) {
            this.loadAmenities();
        }
    },
    async loadAmenities() {
        try {
            const amenities = await (0, property_1.getPropertyAmenities)(this.data.property.id);
            if (amenities && amenities.amenities) {
                for (const cat of Object.values(amenities.amenities)) {
                    for (const poi of cat) {
                        if (poi.distance < 1000) {
                            poi.distanceText = poi.distance + 'm';
                        }
                        else {
                            poi.distanceText = (poi.distance / 1000).toFixed(1) + 'km';
                        }
                    }
                }
            }
            this.setData({ amenities });
        }
        catch (e) {
            console.error('加载周边配套失败:', e);
        }
    },
});
