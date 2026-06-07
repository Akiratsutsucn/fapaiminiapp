"use strict";
Component({
    properties: {
        images: { type: Array, value: [] },
        autoplay: { type: Boolean, value: true },
    },
    data: { current: 0 },
    methods: {
        onSwiperChange(e) {
            this.setData({ current: e.detail.current });
        },
        onImageError() {
        },
    },
});
