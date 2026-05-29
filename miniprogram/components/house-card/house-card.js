"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const format_1 = require("../../utils/format");
function priceNumberOnly(price) {
    if (!price || price === 0)
        return '--';
    const wan = price / 10000;
    if (wan >= 10000)
        return (wan / 10000).toFixed(2);
    return wan.toFixed(0);
}
Component({
    properties: {
        property: {
            type: Object,
            value: {},
        },
    },
    computed: {},
    observers: {
        property(p) {
            if (!p)
                return;
            const startingNum = priceNumberOnly(p.starting_price);
            const wan = (p.starting_price || 0) / 10000;
            const showAsYi = wan >= 10000;
            const saving = (p.appraisal_price || 0) - (p.starting_price || 0);
            const savingWan = saving > 0 ? priceNumberOnly(saving) : '';
            this.setData({
                coverImage: p.cover_image || '/images/default-house.png',
                statusLabel: (0, format_1.statusLabel)(p.auction_status),
                statusTagClass: (0, format_1.statusTagClass)(p.auction_status),
                startingPriceWan: startingNum,
                startingUnit: showAsYi ? '亿起' : '万起',
                appraisalPriceWan: priceNumberOnly(p.appraisal_price),
                district: p.district || '',
                propertyType: p.property_type || '',
                auctionRound: p.auction_round || '',
                area: p.area ? p.area.toFixed(2) : '',
                layout: p.layout || '',
                title: p.title || '',
                discount: p.court_discount_rate ? (0, format_1.formatDiscount)(p.court_discount_rate) : '',
                savingWan,
                auctionTime: p.auction_start_time ? (0, format_1.formatDate)(p.auction_start_time, 'MM-DD HH:mm') : '',
            });
        },
    },
    data: {
        coverImage: '',
        statusLabel: '',
        statusTagClass: '',
        startingPriceWan: '',
        startingUnit: '万起',
        appraisalPriceWan: '',
        district: '',
        propertyType: '',
        auctionRound: '',
        area: '',
        layout: '',
        title: '',
        discount: '',
        savingWan: '',
        auctionTime: '',
    },
    methods: {
        onTap() {
            const p = this.properties.property;
            if (p && p.id) {
                wx.navigateTo({ url: `/pages/property-detail/property-detail?id=${p.id}` });
            }
        },
    },
});
